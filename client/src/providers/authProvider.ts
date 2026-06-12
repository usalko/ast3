import type { AuthProvider } from "@refinedev/core";
import { gqlQuery } from "@/api/graphql";

const TOKEN_KEY = "ast3_access";
const REFRESH_KEY = "ast3_refresh";

async function gql(query: string, variables?: Record<string, unknown>) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch("/graphql/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    const data = await gql(
      `mutation Login($email: String!, $password: String!) {
        tokenObtainPair(email: $email, password: $password) {
          access refresh
        }
      }`,
      { email, password }
    );
    const tokens = data?.data?.tokenObtainPair;
    if (!tokens) {
      return { success: false, error: { name: "Login failed", message: "Invalid credentials" } };
    }
    localStorage.setItem(TOKEN_KEY, tokens.access);
    localStorage.setItem(REFRESH_KEY, tokens.refresh);
    return { success: true, redirectTo: "/" };
  },

  logout: async () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return { authenticated: false, redirectTo: "/login" };
    try {
      const data = await gqlQuery<{ me: { id: string } | null }>(`query { me { id } }`);
      return data.me ? { authenticated: true } : { authenticated: false, redirectTo: "/login" };
    } catch {
      return { authenticated: false, redirectTo: "/login" };
    }
  },

  getPermissions: async () => null,

  getIdentity: async () => {
    const data = await gql(`query { me { id email fullName } }`);
    return data?.data?.me ?? null;
  },

  onError: async (error) => {
    if (error?.statusCode === 401) {
      return { logout: true };
    }
    return { error };
  },
};
