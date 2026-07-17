import type { AuthProvider } from "@refinedev/core";
import { GraphQLClient } from "graphql-request";
import { clearAuthStorage, hasValidSessionStorage } from "@/utils/authTokens";

const TOKEN_KEY = "ast3_access";
const REFRESH_KEY = "ast3_refresh";
type GraphQLHeaders = Record<string, string>;

const client = new GraphQLClient("/graphql/", {
  headers: (): GraphQLHeaders => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return {};
    }
    return { Authorization: `Bearer ${token}` };
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
    clearAuthStorage();
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    if (!hasValidSessionStorage()) {
      clearAuthStorage();
      return { authenticated: false, redirectTo: "/login" };
    }
    return { authenticated: true };
  },

  getPermissions: async () => null,

  getIdentity: async () => {
    try {
      const data = await client.request<{ me: { id: string; email: string; fullName: string; isStaff: boolean; isSuperuser: boolean } | null }>(
        `query { me { id email fullName isStaff isSuperuser } }`
      );
      return data.me ?? { id: "", email: "—", fullName: "—", isStaff: false, isSuperuser: false };
    } catch {
      try {
        const data = await client.request<{ me: { id: string; email: string; fullName: string } | null }>(
          `query { me { id email fullName } }`
        );
        return data.me ?? { id: "", email: "—", fullName: "—" };
      } catch {
        return { id: "", email: "—", fullName: "—" };
      }
    }
  },

  onError: async (error) => {
    if (error?.statusCode === 401) {
      return { logout: true };
    }
    return { error };
  },
};
