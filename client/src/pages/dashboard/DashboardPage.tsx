import { useEffect, useMemo, useState } from "react";
import { Card, Col, Empty, Progress, Row, Spin, Statistic, Table, Tag, Typography } from "antd";
import { Link } from "react-router-dom";
import { gqlQuery } from "@/api/graphql";

type Project = { id: string; code?: string; name: string; progress?: number | null; type?: string };
type Task = { id: string; title: string; progress?: number | null; status: { name: string; code: string; isDone?: boolean } };

const { Text } = Typography;

export function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    gqlQuery<{ projects: Project[] }>(
      `query {
        projects { id code name progress type }
      }`
    )
      .then(async (res) => {
        const projectList = res.projects ?? [];
        setProjects(projectList);
        const taskMap: Record<string, Task[]> = {};
        await Promise.all(
          projectList.map(async (project) => {
            const taskRes = await gqlQuery<{ tasks: Task[] }>(
              `query ($projectId: ID!) { tasks(projectId: $projectId) { id title progress status { name code isDone } } }`,
              { projectId: project.id }
            );
            taskMap[project.id] = taskRes.tasks ?? [];
          })
        );
        setTasksByProject(taskMap);
      })
      .catch(() => {
        setProjects([]);
        setTasksByProject({});
      })
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(() => {
    const allTasks = Object.values(tasksByProject).flat();
    const done = allTasks.filter((task) => task.status.isDone || task.status.code === "done").length;
    const avgProgress = allTasks.length === 0 ? 0 : Math.round(allTasks.reduce((sum, task) => sum + (task.progress ?? 0), 0) / allTasks.length);
    return { tasks: allTasks.length, done, avgProgress };
  }, [tasksByProject]);

  return (
    <div style={{ padding: 16 }}>
      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col span={6}><Card><Statistic title="Проекты" value={projects.length} /></Card></Col>
          <Col span={6}><Card><Statistic title="Задачи" value={totals.tasks} /></Card></Col>
          <Col span={6}><Card><Statistic title="Выполнено" value={totals.done} /></Card></Col>
          <Col span={6}><Card><Statistic title="Средний прогресс" value={totals.avgProgress} suffix="%" /></Card></Col>
          <Col span={12}>
            <Card title="Быстрый переход">
              <Link to="/kanban">Канбан-доски</Link><br />
              <Link to="/time-tracking">Тайм-трекинг</Link><br />
              <Link to="/gantt">Диаграмма Ганта</Link><br />
              <Link to="/analytics">Аналитика</Link>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card title="Проекты">
              {projects.length === 0 ? <Empty description="Нет проектов" /> : (
                <Table
                  rowKey="id"
                  dataSource={projects}
                  pagination={false}
                  size="small"
                  columns={[
                    { title: "Проект", key: "name", render: (_, record: Project) => <Link to={`/projects/${record.id}`}>{record.name}</Link> },
                    { title: "Тип", dataIndex: "type", key: "type", render: (value?: string) => projectTypeLabel(value) },
                    { title: "Задачи", key: "tasks", render: (_, record: Project) => tasksByProject[record.id]?.length ?? 0 },
                    { title: "Прогресс", dataIndex: "progress", key: "progress", render: (value?: number) => <Progress percent={value ?? 0} size="small" /> },
                  ]}
                />
              )}
            </Card>
          </Col>
          <Col span={12}>
            <Card title="Недавние задачи">
              {Object.values(tasksByProject).flat().slice(0, 8).map((task) => (
                <div key={task.id} style={{ marginBottom: 8 }}>
                  <SpaceLine>
                    <Text strong>{task.title}</Text>
                    <Tag>{task.status.name}</Tag>
                    <Text type="secondary">{task.progress ?? 0}%</Text>
                  </SpaceLine>
                  <Progress percent={task.progress ?? 0} size="small" />
                </div>
              ))}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}

function projectTypeLabel(value?: string) {
  if (value === "hardware") return "Производство";
  if (value === "research") return "Исследования";
  return "ПО";
}

function SpaceLine({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{children}</div>;
}
