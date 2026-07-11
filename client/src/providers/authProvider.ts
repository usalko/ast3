import type { AuthProvider } from "@refinedev/core";
import { GraphQLClient } from "graphql-request";

const TOKEN_KEY = "ast3_access";
const REFRESH_KEY = "ast3_refresh";

const client = new GraphQLClient("/graphql/", {
  headers: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      const data = await client.request<{
        tokenObtainPair: { access: string; refresh: string };
      }>(
        `mutation Login($email: String!, $password: String!) {
          tokenObtainPair(email: $email, password: $password) {
            access refresh
          }
        }`,
        { email, password }
      );
      const tokens = data.tokenObtainPair;
      if (!tokens?.access) {
        return { success: false, error: { name: "Login failed", message: "Invalid credentials" } };
      }
      localStorage.setItem(TOKEN_KEY, tokens.access);
      localStorage.setItem(REFRESH_KEY, tokens.refresh);
      window.location.replace("/");
      return { success: true, redirectTo: "/" };
    } catch (err) {
      return { success: false, error: { name: "Login failed", message: String(err) } };
    }
  },

  logout: async () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return { authenticated: false, redirectTo: "/login" };
    return { authenticated: true };
  },

  getPermissions: async () => null,

  getIdentity: async () => {
    try {
      const data = await client.request<{ me: { id: string; email: string; fullName: string; isStaff: boolean; isSuperuser: boolean } | null }>(
        `query { me { id email fullName isStaff isSuperuser } }`
      );
      return data.me ?? null;
    } catch {
      return null;
    }
  },

  onError: async (error) => {
    if (error?.statusCode === 401) {
      return { logout: true };
    }
    return { error };
  },
};
