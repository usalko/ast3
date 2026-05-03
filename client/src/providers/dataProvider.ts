import { GraphQLClient } from "graphql-request";
import type { DataProvider } from "@refinedev/core";

/**
 * Minimal GraphQL data provider for Refine.
 * Maps Refine's CRUD operations to GraphQL queries/mutations.
 * Extend as needed for each resource.
 */
export function dataProvider(url: string): DataProvider {
  const client = new GraphQLClient(url, {
    headers: () => {
      const token = localStorage.getItem("ast3_access");
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
  });

  return {
    getList: async ({ resource, filters, sorters, pagination }) => {
      // Delegated to resource-specific hooks; this is a fallback.
      const data = await client.request<{ [key: string]: unknown[] }>(
        `query List_${resource} { ${resource} { id } }`
      );
      const items = (data[resource] as unknown[]) ?? [];
      return { data: items as never[], total: items.length };
    },

    getOne: async ({ resource, id }) => {
      const data = await client.request<{ [key: string]: unknown }>(
        `query Get_${resource}($id: ID!) { ${resource}(id: $id) { id } }`,
        { id }
      );
      return { data: data[resource] as never };
    },

    create: async ({ resource, variables }) => {
      throw new Error(`create not implemented for ${resource} — use domain mutations`);
    },

    update: async ({ resource, id, variables }) => {
      throw new Error(`update not implemented for ${resource} — use domain mutations`);
    },

    deleteOne: async ({ resource, id }) => {
      throw new Error(`deleteOne not implemented for ${resource}`);
    },

    getApiUrl: () => url,
  };
}
