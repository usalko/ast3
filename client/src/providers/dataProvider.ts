import { GraphQLClient } from "graphql-request";
import type { DataProvider } from "@refinedev/core";

type GraphQLHeaders = Record<string, string>;

interface GraphQLResponse<T = unknown> {
  data?: Record<string, T>;
  errors?: { message: string }[];
}

function unwrapSingle(response: GraphQLResponse, field: string): never[] {
  const items = (response.data?.[field] ?? []) as never[];
  return items;
}

export function dataProvider(url: string): DataProvider {
  const buildHeaders = (): GraphQLHeaders => {
    const token = localStorage.getItem("ast3_access");
    const headers: GraphQLHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    const refresh = localStorage.getItem("ast3_refresh");
    if (refresh) {
      headers["x-refresh-token"] = refresh;
    }
    return headers;
  };

  const client = new GraphQLClient(url, {
    headers: buildHeaders,
    credentials: "include",
  });

  const asBaseMutation = <T>(
    query: string,
    variables: Record<string, unknown>,
    field: string,
  ): Promise<{ data: T }> => {
    return client.request<{ [key: string]: T }>(query, variables).then((res) => {
      const value = res.data?.[field];
      if (!value) {
        throw new Error(res.errors?.map((e) => e.message).join(", ") || `No data for ${field}`);
      }
      return { data: value as T };
    });
  };

  const projectFields = `
      id code name description type status plannedStart plannedEnd actualStart actualEnd budgetHours progress createdAt lead { id email firstName lastName department { id name } } department { id name code } statuses { id name code color order isDone isCancelled }
    `;

  const taskFields = `
      id code title description type priority progress riskLevel isOverdue plannedStart plannedEnd actualStart actualEnd estimatedHours boardOrder createdAt updatedAt status { id name code color order isDone isCancelled } assignee { id email firstName lastName department { id name } } reporter { id email firstName lastName department { id name } }
    `;

  return {
    getApiUrl: () => url,

    getList: async ({ resource }) => {
      let query = "";
      let field = "";
      let variables: Record<string, unknown> = {};

      switch (resource) {
        case "projects":
          query = `query ListProjects { projects { ${projectFields} } }`;
          field = "projects";
          break;
        case "tasks": {
          const projectId = (arguments as unknown as { id?: string }).id;
          query = `query ListTasks($projectId: ID!) { tasks(projectId: $projectId) { ${taskFields} } }`;
          field = "tasks";
          variables = { projectId: projectId ?? "" };
          break;
        }
        case "time-tracking": {
          const taskId = (arguments as unknown as { taskId?: string }).taskId;
          const projectId = (arguments as unknown as { projectId?: string }).projectId;
          const userId = (arguments as unknown as { userId?: string }).userId;
          query = `query TimeEntries($taskId: ID, $projectId: ID, $userId: ID, $includeAll: Boolean) { timeEntries(taskId: $taskId, projectId: $projectId, userId: $userId, includeAll: $includeAll) { id startTime endTime durationMinutes source description isLocked createdAt user { id email firstName lastName } task { id code } } }`;
          field = "timeEntries";
          variables = { taskId: taskId ?? null, projectId: projectId ?? null, userId: userId ?? null, includeAll: true };
          break;
        }
        default:
          throw new Error(`getList not implemented for resource: ${resource}`);
      }

      const response = await client.request<{ [key: string]: unknown[] }>(query, variables);
      const items = (response.data?.[field] ?? []) as never[];
      return { data: items, total: items.length };
    },

    getOne: async ({ resource, id }) => {
      let query = "";
      let field = "";

      switch (resource) {
        case "projects":
          query = `query GetProject($id: ID!) { project(id: $id) { ${projectFields} } }`;
          field = "project";
          break;
        case "tasks":
          query = `query GetTask($id: ID!) { task(id: $id) { ${taskFields} } }`;
          field = "task";
          break;
        default:
          throw new Error(`getOne not implemented for resource: ${resource}`);
      }

      const response = await client.request<{ [key: string]: unknown }>(query, { id });
      const data = response.data?.[field];
      if (!data) {
        throw new Error(response.errors?.map((e) => e.message).join(", ") || `Not found`);
      }
      return { data: data as never };
    },

    create: async ({ resource, variables }) => {
      switch (resource) {
        case "projects": {
          const input = variables?.variables ?? variables;
          const mutation = `mutation CreateProject($input: CreateProjectInput!) { createProject(input: $input) { ${projectFields} } }`;
          const { data } = await asBaseMutation<never>(mutation, { input }, "createProject");
          return { data };
        }
        case "tasks": {
          const input = variables?.variables ?? variables;
          const mutation = `mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { ${taskFields} } }`;
          const { data } = await asBaseMutation<never>(mutation, { input }, "createTask");
          return { data };
        }
        default:
          throw new Error(`create not implemented for resource: ${resource}`);
      }
    },

    update: async ({ resource, id, variables }) => {
      const input = variables?.variables ?? variables;
      switch (resource) {
        case "projects": {
          const mutation = `mutation UpdateProject($id: ID!, $input: UpdateProjectInput!) { updateProject(id: $id, input: $input) { code } }`;
          const { data } = await asBaseMutation<{ code: string }>(mutation, { id, input }, "updateProject");
          return { data: data as never };
        }
        case "tasks": {
          const mutation = `mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) { updateTask(id: $id, input: $input) { code } }`;
          const { data } = await asBaseMutation<{ code: string }>(mutation, { id, input }, "updateTask");
          return { data: data as never };
        }
        default:
          throw new Error(`update not implemented for resource: ${resource}`);
      }
    },

    updateMany: async () => {
      return { data: [] };
    },

    deleteOne: async ({ resource, id, variables }) => {
      switch (resource) {
        case "projects": {
          const mutation = `mutation DeleteProject($id: ID!) { deleteProject(id: $id) { success } }`;
          const { data } = await asBaseMutation<{ success: boolean }>(mutation, { id }, "deleteProject");
          return { data: data as never, ...(variables?.meta ?? {}) };
        }
        case "tasks": {
          const mutation = `mutation DeleteTask($id: ID!) { deleteTask(id: $id) }`;
          const { data } = await asBaseMutation<boolean>(mutation, { id }, "deleteTask");
          return { data: data as never, ...(variables?.meta ?? {}) };
        }
        default:
          throw new Error(`deleteOne not implemented for resource: ${resource}`);
      }
    },

    deleteMany: async () => {
      return { data: [] };
    },

    custom: async () => {
      return { data: {} as never };
    },
  };
}
