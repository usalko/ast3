import { useEffect, useMemo, useState } from "react";
import { Card, Col, Empty, Progress, Row, Spin, Statistic, Table, Tag, Typography, theme } from "antd";
import { Link } from "react-router-dom";
import { CheckCircleFilled, ClockCircleFilled, CloseCircleFilled, ExclamationCircleFilled, ProjectFilled, UnorderedListOutlined } from "@ant-design/icons";
import { gqlQuery } from "@/api/graphql";
import { riskColor, riskLabel } from "@/utils/riskLabels";
import { statusLabel } from "@/utils/statusLabels";

type Project = { id: string; code?: string; name: string; progress?: number | null; type?: string; status?: string };
type Task = { id: string; title: string; progress?: number | null; priority?: number; isOverdue?: boolean | null; status: { name: string; code: string; isDone?: boolean } };

const { Text, Title } = Typography;

function projectTypeLabel(value?: string) {
  if (value === "hardware") return "Производство";
  if (value === "research") return "Исследования";
  return "ПО";
}

export function DashboardPage() {
  const { token } = theme.useToken();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    gqlQuery<{ projects: Project[] }>("query { projects { id code name progress type status } }")
      .then(async (res) => {
        const projectList = res.projects ?? [];
        setProjects(projectList);
        const taskMap: Record<string, Task[]> = {};
        await Promise.all(
          projectList.map(async (project) => {
            const taskRes = await gqlQuery<{ tasks: Task[] }>("query ($projectId: ID!) { tasks(projectId: $projectId) { id title progress priority isOverdue status { name code isDone } } }", { projectId: project.id });
            taskMap[project.id] = taskRes.tasks ?? [];
          }),
        );
        setTasksByProject(taskMap);
      })
      .catch(() => {
        setProjects([]);
        setTasksByProject({});
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const allTasks = Object.values(tasksByProject).flat().filter((t) => t.status.code !== "backlog");
    const done = allTasks.filter((task) => task.status.isDone || task.status.code === "done").length;
    const overdue = allTasks.filter((task) => task.isOverdue).length;
    const cancelled = allTasks.filter((task) => task.status.code === "cancelled").length;
    const avgProgress = allTasks.length === 0 ? 0 : Math.round(allTasks.reduce((sum, task) => sum + (task.progress ?? 0), 0) / allTasks.length);
    const byProjectStats = projects.map((p) => ({
      project: p,
      tasks: (tasksByProject[p.id] ?? []).filter((t) => t.status.code !== "backlog"),
      done: (tasksByProject[p.id] ?? []).filter((t) => t.status.isDone || t.status.code === "done").length,
      overdue: (tasksByProject[p.id] ?? []).filter((t) => t.isOverdue).length,
      progress: p.progress ?? 0,
    }));
    return { allTasks, done, overdue, cancelled, avgProgress, byProjectStats, total: allTasks.length };
  }, [projects, tasksByProject]);

  return (
    <div style={{ padding: 16, background: token.colorBgLayout, minHeight: "100vh" }}>
      <Spin spinning={loading}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ margin: 0 }}><span style={{ fontSize: 20 }}>Обзор проектов</span></Title>
          <Text type="secondary">Статистика по всем проектам и задачам</Text>
        </div>

        {/* Large project + tasks cards */}
        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <Card>
              <Statistic title={<span style={{ fontSize: 18 }}>Проекты</span>} valueStyle={{ fontSize: 48, fontWeight: 700 }} value={projects.length} prefix={<ProjectFilled style={{ color: token.colorPrimary, marginRight: 12 }} />} />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card>
              <Statistic title={<span style={{ fontSize: 18 }}>Задачи</span>} valueStyle={{ fontSize: 48, fontWeight: 700 }} value={stats.total} prefix={<UnorderedListOutlined style={{ color: token.colorInfo, marginRight: 12 }} />} />
            </Card>
          </Col>
        </Row>

        {/* Stat cards row 2 */}
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col xs={12} md={6}>
            <Card style={{ borderLeft: `4px solid ${token.colorSuccess}` }}>
              <Statistic title="Выполнено" valueStyle={{ fontSize: 28 }} value={stats.done} suffix={`/ ${stats.total}`} prefix={<CheckCircleFilled style={{ color: token.colorSuccess, marginRight: 8 }} />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card style={{ borderLeft: `4px solid ${token.colorWarning}` }}>
              <Statistic title="Отменено" valueStyle={{ fontSize: 28 }} value={stats.cancelled} prefix={<CloseCircleFilled style={{ color: token.colorWarning, marginRight: 8 }} />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card style={{ borderLeft: `4px solid ${stats.overdue > 0 ? token.colorError : token.colorWarning}` }}>
              <Statistic title="Просрочено" valueStyle={{ fontSize: 28 }} value={stats.overdue} prefix={<ClockCircleFilled style={{ color: stats.overdue > 0 ? token.colorError : token.colorWarning, marginRight: 8 }} />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card style={{ borderLeft: `4px solid ${token.colorInfo}` }}>
              <Statistic title="Средний прогресс" valueStyle={{ fontSize: 28 }} value={stats.avgProgress} suffix="%" prefix={<ExclamationCircleFilled style={{ color: token.colorInfo, marginRight: 8 }} />} />
            </Card>
          </Col>
        </Row>



        {/* Two-column layout: project table + recent tasks */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={14}>
            <Card title="Проекты" style={{ fontSize: 16 }} bodyStyle={{ padding: 0 }}>
              {projects.length === 0 ? (
                <Empty description="Нет проектов" style={{ padding: 32 }} />
              ) : (
                <Table
                  rowKey="id"
                  dataSource={projects}
                  pagination={false}
                  size="default"
                  showHeader={false}
                  columns={[
                    {
                      key: "project",
                      render: (_, record: Project) => {
                        const pstats = stats.byProjectStats.find((s) => s.project.id === record.id);
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
                            <div style={{ flex: 1 }}>
                              <Link to={`/projects/${record.id}`} style={{ fontWeight: 600, fontSize: 16 }}>{`${record.code ? `[${record.code}] ` : ""}${record.name}`}</Link>
                              <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                                <Text type="secondary" style={{ fontSize: 13 }}>Задач: {pstats?.tasks.length ?? 0}</Text>
                                <Text type="secondary" style={{ fontSize: 13 }}>Выполнено: {pstats?.done ?? 0}</Text>
                                {pstats && pstats.overdue > 0 && <Text type="danger" style={{ fontSize: 13 }}>Просрочек: {pstats.overdue}</Text>}
                              </div>
                            </div>
                            <div style={{ width: 120 }}>
                              <Progress percent={record.progress ?? 0} size="default" />
                            </div>
                          </div>
                        );
                      },
                    },
                  ]}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card title="Последние задачи" style={{ fontSize: 16 }} bodyStyle={{ padding: "0 16px" }}>
              {stats.allTasks.length === 0 ? (
                <Empty description="Нет задач" style={{ padding: 32 }} />
              ) : (
                stats.allTasks.slice(0, 6).map((task) => (
                  <div key={task.id} style={{ padding: "12px 0", borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong ellipsis style={{ display: "block" }}>{task.title}</Text>
                        <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                          <Tag style={{ fontSize: 12 }}>{statusLabel(task.status.code, task.status.name)}</Tag>
                          <Tag color={riskColor(task.priority)} style={{ fontSize: 12 }}>{task.isOverdue ? "Просрочено" : riskLabel(task.priority)}</Tag>
                        </div>
                      </div>
                      <Progress type="circle" percent={task.progress ?? 0} size={44} style={{ flexShrink: 0 }} />
                    </div>
                  </div>
                ))
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}

function SpaceLine({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{children}</div>;
}