import { useEffect, useMemo, useState } from "react";
import { Card, Col, Progress, Row, Statistic, Table, Typography, Empty, Spin } from "antd";
import { gqlQuery } from "@/api/graphql";

type Department = { id: string; name: string; code?: string };
type User = { id: string; fullName?: string | null; department?: Department | null };
type Project = {
  id: string;
  code?: string;
  name: string;
  type?: string;
  status?: string;
  progress?: number | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  department?: Department | null;
  lead?: User | null;
};
type TaskStatus = { id: string; name: string; code: string; isDone?: boolean };
type Task = {
  id: string;
  code?: string;
  title: string;
  progress?: number | null;
  estimatedHours?: number | null;
  status: TaskStatus;
  assignee?: User | null;
};
type TimeEntry = {
  id: string;
  durationMinutes?: number | null;
  durationHours?: number | null;
  task: { id: string };
  user?: User | null;
};

const { Text } = Typography;

type ProjectStats = {
  project: Project;
  tasks: Task[];
  entries: TimeEntry[];
  avgProgress: number;
  done: number;
  estimatedHours: number;
  actualHours: number;
};

export function AnalyticsPage() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ProjectStats[]>([]);

  useEffect(() => {
    setLoading(true);
    gqlQuery<{ projects: Project[]; users: User[] }>(
      `query {
        projects {
          id code name type status progress plannedStart plannedEnd
          department { id name code }
          lead { id fullName department { id name code } }
        }
      }`
    )
      .then(async (res) => {
        const projectList = res.projects ?? [];
        const projectStats = await Promise.all(projectList.map(loadProjectStats));
        setStats(projectStats);
      })
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(() => {
    const taskCount = stats.reduce((sum, item) => sum + item.tasks.length, 0);
    const doneCount = stats.reduce((sum, item) => sum + item.done, 0);
    const estimated = stats.reduce((sum, item) => sum + item.estimatedHours, 0);
    const actual = stats.reduce((sum, item) => sum + item.actualHours, 0);
    const avgProgress = taskCount === 0 ? 0 : Math.round(stats.reduce((sum, item) => sum + item.avgProgress * item.tasks.length, 0) / taskCount);
    return { taskCount, doneCount, estimated, actual, avgProgress };
  }, [stats]);

  const peopleRows = useMemo(() => {
    const grouped = new Map<string, { user: User; tasks: number; done: number; progress: number[]; hours: number }>();
    for (const item of stats) {
      for (const task of item.tasks) {
        const user = task.assignee ?? { id: "unassigned", fullName: "Без исполнителя", department: null };
        const current = grouped.get(user.id) ?? { user, tasks: 0, done: 0, progress: [], hours: 0 };
        current.tasks += 1;
        current.done += task.status.isDone || task.status.code === "done" ? 1 : 0;
        current.progress.push(task.progress ?? 0);
        current.hours += hoursForTask(task.id, item.entries);
        grouped.set(user.id, current);
      }
    }
    return [...grouped.values()].map((row) => ({
      ...row,
      avgProgress: row.tasks === 0 ? 0 : Math.round(row.progress.reduce((sum, value) => sum + value, 0) / row.progress.length),
    }));
  }, [stats]);

  const departmentRows = useMemo(() => {
    const grouped = new Map<string, { name: string; tasks: number; done: number; progress: number[]; hours: number }>();
    for (const item of stats) {
      for (const task of item.tasks) {
        const departmentName = task.assignee?.department?.name ?? "Без подразделения";
        const current = grouped.get(departmentName) ?? { name: departmentName, tasks: 0, done: 0, progress: [], hours: 0 };
        current.tasks += 1;
        current.done += task.status.isDone || task.status.code === "done" ? 1 : 0;
        current.progress.push(task.progress ?? 0);
        current.hours += hoursForTask(task.id, item.entries);
        grouped.set(departmentName, current);
      }
    }
    return [...grouped.values()].map((row) => ({
      ...row,
      avgProgress: row.tasks === 0 ? 0 : Math.round(row.progress.reduce((sum, value) => sum + value, 0) / row.progress.length),
    }));
  }, [stats]);

  return (
    <div style={{ padding: 16 }}>
      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col span={6}><Card><Statistic title="Проекты" value={stats.length} /></Card></Col>
          <Col span={6}><Card><Statistic title="Задачи" value={totals.taskCount} /></Card></Col>
          <Col span={6}><Card><Statistic title="Выполнено" value={totals.doneCount} precision={0} /></Card></Col>
          <Col span={6}><Card><Statistic title="Средний прогресс" value={totals.avgProgress} suffix="%" /></Card></Col>
          <Col span={12}><Card><Statistic title="Оценка, ч" value={round(totals.estimated)} precision={1} /></Card></Col>
          <Col span={12}><Card><Statistic title="Факт, ч" value={round(totals.actual)} precision={1} /></Card></Col>
        </Row>

        {stats.length === 0 ? (
          <Empty description="Нет данных для аналитики" style={{ marginTop: 24 }} />
        ) : (
          <>
            <Card title="Прогресс по проектам" style={{ marginTop: 16 }}>
              <Table
                rowKey={(record) => record.project.id}
                dataSource={stats}
                pagination={false}
                size="small"
                columns={[
                  { title: "Проект", key: "project", render: (_, record) => <Text strong>{record.project.name}</Text> },
                  { title: "Тип", dataIndex: ["project", "type"], key: "type", render: (value?: string) => projectTypeLabel(value) },
                  { title: "Подразделение", dataIndex: ["project", "department", "name"], key: "department", render: (value?: string) => value ?? "—" },
                  { title: "Задачи", dataIndex: "tasks", key: "tasks", render: (_: unknown, record: ProjectStats) => record.tasks.length },
                  { title: "Готово", dataIndex: "done", key: "done" },
                  { title: "Прогресс", dataIndex: "avgProgress", key: "progress", render: (value: number) => <Progress percent={value} size="small" /> },
                  { title: "Оценка/факт, ч", key: "hours", render: (_, record: ProjectStats) => `${round(record.estimatedHours)} / ${round(record.actualHours)}` },
                ]}
              />
            </Card>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col span={12}>
                <Card title="Прогресс по людям">
                  <Table
                    rowKey={(record) => record.user.id}
                    dataSource={peopleRows}
                    pagination={{ pageSize: 8 }}
                    size="small"
                    columns={[
                      { title: "Сотрудник", key: "user", render: (_, record) => <Text strong>{record.user.fullName}</Text> },
                      { title: "Подразделение", dataIndex: ["user", "department", "name"], key: "department", render: (value?: string) => value ?? "—" },
                      { title: "Задачи", dataIndex: "tasks", key: "tasks" },
                      { title: "Готово", dataIndex: "done", key: "done" },
                      { title: "Прогресс", dataIndex: "avgProgress", key: "progress", render: (value: number) => <Progress percent={value} size="small" /> },
                      { title: "Часы", dataIndex: "hours", key: "hours", render: (value: number) => round(value) },
                    ]}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Прогресс по подразделениям">
                  <Table
                    rowKey="name"
                    dataSource={departmentRows}
                    pagination={false}
                    size="small"
                    columns={[
                      { title: "Подразделение", dataIndex: "name", key: "name", render: (value: string) => <Text strong>{value}</Text> },
                      { title: "Задачи", dataIndex: "tasks", key: "tasks" },
                      { title: "Готово", dataIndex: "done", key: "done" },
                      { title: "Прогресс", dataIndex: "avgProgress", key: "progress", render: (value: number) => <Progress percent={value} size="small" /> },
                      { title: "Часы", dataIndex: "hours", key: "hours", render: (value: number) => round(value) },
                    ]}
                  />
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Spin>
    </div>
  );
}

async function loadProjectStats(project: Project): Promise<ProjectStats> {
  const [tasksRes, entriesRes] = await Promise.all([
    gqlQuery<{ tasks: Task[] }>(
      `query ($projectId: ID!) {
        tasks(projectId: $projectId) {
          id code title progress estimatedHours status { id name code isDone }
          assignee { id fullName department { id name code } }
        }
      }`,
      { projectId: project.id }
    ),
    gqlQuery<{ timeEntries: TimeEntry[] }>(
      `query ($projectId: ID!) { timeEntries(projectId: $projectId, includeAll: true) { id durationMinutes durationHours task { id } user { id fullName department { id name code } } } }`,
      { projectId: project.id }
    ),
  ]);
  const tasks = tasksRes.tasks ?? [];
  const entries = entriesRes.timeEntries ?? [];
  const avgProgress = tasks.length === 0 ? 0 : Math.round(tasks.reduce((sum, task) => sum + (task.progress ?? 0), 0) / tasks.length);
  const done = tasks.filter((task) => task.status.isDone || task.status.code === "done").length;
  const estimatedHours = tasks.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0);
  const actualHours = entries.reduce((sum, entry) => sum + (entry.durationHours ?? (entry.durationMinutes ?? 0) / 60), 0);
  return { project, tasks, entries, avgProgress, done, estimatedHours, actualHours };
}

function hoursForTask(taskId: string, entries: TimeEntry[]) {
  return entries.filter((entry) => entry.task.id === taskId).reduce((sum, entry) => sum + (entry.durationHours ?? (entry.durationMinutes ?? 0) / 60), 0);
}

function projectTypeLabel(value?: string) {
  if (value === "hardware") return "Производство";
  if (value === "research") return "Исследования";
  return "ПО";
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
