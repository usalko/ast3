import { GraphQLClient } from "graphql-request";

type GraphQLHeaders = Record<string, string>;
type GraphQLErrorLike = {
  name?: string;
  message?: string;
  response?: { status?: number };
};

const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL ?? "/graphql/";
const ACCESS_TOKEN_KEY = "ast3_access";
const REFRESH_TOKEN_KEY = "ast3_refresh";

export const client = new GraphQLClient(GRAPHQL_URL, {
  headers: (): GraphQLHeaders => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});

let refreshPromise: Promise<boolean> | null = null;

export async function gqlQuery<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
  try {
    return await client.request<T>(query, variables);
  } catch (error) {
    if (isUnauthorized(error)) {
      const refreshed = await deduplicatedRefresh();
      if (refreshed) {
        return client.request<T>(query, variables);
      }
    }
    throw error;
  }
}

function isUnauthorized(error: unknown) {
  const graphQLError = error as GraphQLErrorLike;
  const status = graphQLError.response?.status;
  
  // Check HTTP status
  if (status === 401) return true;
  
  // Check GraphQL errors array for auth-related messages
  const errors = graphQLError.response?.errors;
  if (Array.isArray(errors)) {
    for (const err of errors) {
      const msg = err.message ?? "";
      if (/expired|unauthorized|authentication|authenticated|anonymous|not authenticated/i.test(msg)) {
        return true;
      }
    }
  }
  
  // Fallback: check error message
  const message = graphQLError.message ?? "";
  return /expired|unauthorized|authentication|authenticated|anonymous|not authenticated/i.test(message);
}

function deduplicatedRefresh(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }
  refreshPromise = doRefreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function doRefreshAccessToken() {
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return false;
  }

  try {
    const response = await client.request<{
      refreshAccessToken: { access: string; refresh?: string };
    }>(
      `mutation RefreshAccessToken($refresh: String!) {
        refreshAccessToken(refresh: $refresh) { access refresh }
      }`,
      { refresh }
    );
    const tokens = response.refreshAccessToken;
    if (!tokens?.access) {
      return false;
    }
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
    if (tokens.refresh) {
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
    }
    return true;
  } catch {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return false;
  }
}
