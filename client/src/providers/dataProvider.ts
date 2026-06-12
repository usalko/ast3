import { GraphQLClient } from "graphql-request";
import type { DataProvider } from "@refinedev/core";

type GraphQLHeaders = Record<string, string>;

/**
 * Minimal GraphQL data provider for Refine.
 * Maps Refine's CRUD operations to GraphQL queries/mutations.
 * Extend as needed for each resource.
 */
export function dataProvider(url: string): DataProvider {
  const client = new GraphQLClient(url, {
    headers: (): GraphQLHeaders => {
      const token = localStorage.getItem("ast3_access");
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
  });

  return {
    getList: async (args: unknown) => {
      // Delegated to resource-specific hooks; this is a fallback.
      const { resource } = args as { resource: string };
      const data = await client.request<{ [key: string]: unknown[] }>(
        `query List_${resource} { ${resource} { id } }`
      );
      const items = (data[resource] as unknown[]) ?? [];
      return { data: items as never[], total: items.length };
    },

    getOne: async (args: unknown) => {
      const { resource, id } = args as { resource: string; id: string };
      const data = await client.request<{ [key: string]: unknown }>(
        `query Get_${resource}($id: ID!) { ${resource}(id: $id) { id } }`,
        { id }
      );
      return { data: data[resource] as never };
    },

    create: async (args: unknown) => {
      const { resource } = args as { resource: string };
      throw new Error(`create not implemented for ${resource} — use domain mutations`);
    },

    update: async (args: unknown) => {
      const { resource } = args as { resource: string };
      throw new Error(`update not implemented for ${resource} — use domain mutations`);
    },

    deleteOne: async (args: unknown) => {
      const { resource } = args as { resource: string };
      throw new Error(`deleteOne not implemented for ${resource}`);
    },

    getApiUrl: () => url,
  };
}
