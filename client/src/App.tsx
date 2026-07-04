import { Refine } from "@refinedev/core";
import "@refinedev/antd/dist/reset.css";
import { ConfigProvider, App as AntApp } from "antd";
import { BrowserRouter, Outlet, Route, Routes, Navigate } from "react-router-dom";

import { authProvider } from "@/providers/authProvider";
import { dataProvider } from "@/providers/dataProvider";
import { ProjectList } from "@/pages/projects/ProjectList";
import { ProjectShow } from "@/pages/projects/ProjectShow";
import { ProjectForm } from "@/pages/projects/ProjectForm";
import { TaskShow } from "@/pages/tasks/TaskShow";
import { TaskForm } from "@/pages/tasks/TaskForm";
import { TaskList } from "@/pages/tasks/TaskList";
import { LoginPage } from "@/pages/auth/LoginPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { KanbanPage } from "@/pages/kanban/KanbanPage";
import { BacklogPage } from "@/pages/backlog/BacklogPage";
import { GanttPage } from "@/pages/gantt/GanttPage";
import { AnalyticsPage } from "@/pages/analytics/AnalyticsPage";
import { TimeTrackingPage } from "@/pages/time-tracking/TimeTrackingPage";
import { TeamPage } from "@/pages/team/TeamPage";
import { AppLayout } from "@/components/SiderMenu";

const TOKEN_KEY = "ast3_access";
const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL ?? "/graphql/";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#9e1e1e",
            colorSuccess: "#16c60c",
            colorWarning: "#f1b327",
            colorError: "#e63946",
            colorInfo: "#419ce2",
            colorBgContainer: "#ffffff",
            colorBgLayout: "#f7f7f7",
            colorText: "#1e1e1e",
            colorTextSecondary: "#444444",
            colorBorder: "#e0e0e0",
            borderRadius: 6,
            fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', Arial, sans-serif",
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
                list: "/tasks",
                show: "/tasks/:id",
                meta: { label: "Задачи" },
              },
              {
                name: "kanban",
                list: "/kanban",
                meta: { label: "Канбан-доска" },
              },
              {
                name: "backlog",
                list: "/backlog",
                meta: { label: "Бэклог" },
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
            options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}
          >
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <RequireAuth>
                    <AppLayout>
                      <Outlet />
                    </AppLayout>
                  </RequireAuth>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="/kanban" element={<KanbanPage />} />
                <Route path="/backlog" element={<BacklogPage />} />
                <Route path="/gantt" element={<GanttPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/time-tracking" element={<TimeTrackingPage />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/projects" element={<ProjectList />} />
                <Route path="/projects/new" element={<ProjectForm />} />
                <Route path="/projects/:id" element={<ProjectShow />} />
                <Route path="/projects/:id/edit" element={<ProjectForm />} />
                <Route path="/tasks" element={<TaskList />} />
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
