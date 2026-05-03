import { Refine } from "@refinedev/core";
import { RefineThemes, ThemedLayoutV2 } from "@refinedev/antd";
import "@refinedev/antd/dist/reset.css";
import { ConfigProvider, App as AntApp } from "antd";
import ruRU from "antd/locale/ru_RU";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";

import { authProvider } from "@/providers/authProvider";
import { dataProvider } from "@/providers/dataProvider";
import { ProjectList } from "@/pages/projects/ProjectList";
import { ProjectShow } from "@/pages/projects/ProjectShow";
import { TaskShow } from "@/pages/tasks/TaskShow";
import { LoginPage } from "@/pages/auth/LoginPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { GanttPage } from "@/pages/gantt/GanttPage";

const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL ?? "/graphql/";

export default function App() {
  return (
    <BrowserRouter>
      <ConfigProvider theme={RefineThemes.Blue} locale={ruRU}>
        <AntApp>
          <Refine
            authProvider={authProvider}
            dataProvider={dataProvider(GRAPHQL_URL)}
            resources={[
              {
                name: "projects",
                list: "/projects",
                show: "/projects/:id",
              },
              {
                name: "tasks",
                show: "/tasks/:id",
              },
            ]}
            options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}
          >
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <ThemedLayoutV2>
                    <Outlet />
                  </ThemedLayoutV2>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="/projects" element={<ProjectList />} />
                <Route path="/projects/:id" element={<ProjectShow />} />
                <Route path="/projects/:projectId/gantt" element={<GanttPage />} />
                <Route path="/tasks/:id" element={<TaskShow />} />
              </Route>
            </Routes>
          </Refine>
        </AntApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}
