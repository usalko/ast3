import { GraphQLClient } from "graphql-request";

type GraphQLHeaders = Record<string, string>;

const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL ?? "/graphql/";

export const client = new GraphQLClient(GRAPHQL_URL, {
  headers: (): GraphQLHeaders => {
    const token = localStorage.getItem("ast3_access");
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});

export async function gqlQuery<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await client.request<T>(query, variables);
  return res;
}
