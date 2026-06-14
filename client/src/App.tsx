import { Refine } from "@refinedev/core";
import { RefineThemes } from "@refinedev/antd";
import "@refinedev/antd/dist/reset.css";
import { ConfigProvider, App as AntApp } from "antd";
import ruRU from "antd/locale/ru_RU";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";

import { authProvider } from "@/providers/authProvider";
import { dataProvider } from "@/providers/dataProvider";
import { ProjectList } from "@/pages/projects/ProjectList";
import { ProjectShow } from "@/pages/projects/ProjectShow";
import { ProjectForm } from "@/pages/projects/ProjectForm";
import { TaskShow } from "@/pages/tasks/TaskShow";
import { TaskForm } from "@/pages/tasks/TaskForm";
import { LoginPage } from "@/pages/auth/LoginPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { KanbanPage } from "@/pages/kanban/KanbanPage";
import { GanttPage } from "@/pages/gantt/GanttPage";
import { AnalyticsPage } from "@/pages/analytics/AnalyticsPage";
import { TimeTrackingPage } from "@/pages/time-tracking/TimeTrackingPage";
import { TeamPage } from "@/pages/team/TeamPage";
import { AppLayout } from "@/components/SiderMenu";

const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL ?? "/graphql/";

export default function App() {
  const neutralTheme = {
    token: {
      colorPrimary: "#4b5563",
      colorSuccess: "#6b7b6e",
      colorWarning: "#a8987a",
      colorError: "#b87a7a",
      colorInfo: "#4b5563",
      borderRadius: 8,
    },
  };
  return (
    <BrowserRouter>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#475569",
            colorSuccess: "#4ade80",
            colorWarning: "#fbbf24",
            colorError: "#ef4444",
            colorInfo: "#64748b",
            colorBgContainer: "#ffffff",
            colorBgLayout: "#f8fafc",
            colorText: "#0f172a",
            colorTextSecondary: "#64748b",
            colorBorder: "#e2e8f0",
            borderRadius: 6,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          },
        }}
        locale={ruRU}
      >
        <AntApp>
          <Refine
            authProvider={authProvider}
            dataProvider={dataProvider(GRAPHQL_URL)}
            resources={[
              {
                name: "projects",
                list: "/projects",
                show: "/projects/:id",
                meta: { label: "Проекты" },
              },
              {
                name: "tasks",
                show: "/tasks/:id",
              },
              {
                name: "kanban",
                list: "/kanban",
                meta: { label: "Канбан-доска" },
              },
              {
                name: "gantt",
                list: "/gantt",
                meta: { label: "Календарь проектов" },
              },
              {
                name: "analytics",
                list: "/analytics",
                meta: { label: "Аналитика" },
              },
              {
                name: "time-tracking",
                list: "/time-tracking",
                meta: { label: "Тайм-трекинг" },
              },
            ]}
            options={{ syncWithLocation: true, warnWhenUnsavedChanges: true, DashboardPage: DashboardPage }}
          >
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <AppLayout>
                    <Outlet />
                  </AppLayout>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="/kanban" element={<KanbanPage />} />
                <Route path="/gantt" element={<GanttPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/time-tracking" element={<TimeTrackingPage />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/projects" element={<ProjectList />} />
                <Route path="/projects/new" element={<ProjectForm />} />
                <Route path="/projects/:id" element={<ProjectShow />} />
                <Route path="/projects/:id/edit" element={<ProjectForm />} />
                <Route path="/tasks/:id" element={<TaskShow />} />
                <Route path="/tasks/:id/edit" element={<TaskForm />} />
              </Route>
            </Routes>
          </Refine>
        </AntApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}
