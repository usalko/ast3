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

export async function gqlQuery<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
  try {
    return await client.request<T>(query, variables);
  } catch (error) {
    if (isUnauthorized(error) && (await refreshAccessToken())) {
      return client.request<T>(query, variables);
    }
    throw error;
  }
}

function isUnauthorized(error: unknown) {
  const graphQLError = error as GraphQLErrorLike;
  const status = graphQLError.response?.status;
  const message = graphQLError.message ?? "";
  return status === 401 || /expired|unauthorized|Authentication required|AnonymousUser/i.test(message);
}

async function refreshAccessToken() {
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.location.href = "/login";
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
    window.location.href = "/login";
    return false;
  }
}
