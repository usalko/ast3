import { useEffect, useMemo, useState } from "react";
import { Card, Col, Empty, Progress, Row, Spin, Statistic, Table, Tag, Typography, theme } from "antd";
import { Link } from "react-router-dom";
import { CheckCircleFilled, ClockCircleFilled, ProjectFilled, UnorderedListOutlined } from "@ant-design/icons";
import { gqlQuery } from "@/api/graphql";
import { riskColor, riskLabel } from "@/utils/riskLabels";
import { statusLabel } from "@/utils/statusLabels";

type Project = { id: string; code?: string; name: string; progress?: number | null };
type Task = { id: string; title: string; progress?: number | null; priority?: number; isOverdue?: boolean | null; status: { name: string; code: string } };

const { Text, Title } = Typography;

export function DashboardPage() {
  const { token } = theme.useToken();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    gqlQuery<{ projects: Project[] }>("query { projects { id code name progress status } }")
      .then(async (res) => {
        const list = res.projects ?? [];
        setProjects(list);
        const map: Record<string, Task[]> = {};
        await Promise.all(list.map(async (p) => {
          const r = await gqlQuery<{ tasks: Task[] }>("query ($pid: ID!) { tasks(projectId: $pid) { id title progress priority isOverdue status { name code } } }", { pid: p.id });
          map[p.id] = r.tasks ?? [];
        }));
        setTasksByProject(map);
      })
      .catch(() => { setProjects([]); setTasksByProject({}); })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const all = Object.values(tasksByProject).flat().filter((t) => t.status.code !== "backlog");
    const done = all.filter((t) => t.status.code === "done" || (t as { isDone?: boolean }).isDone).length;
    const overdue = all.filter((t) => t.isOverdue).length;
    const cancelled = all.filter((t) => t.status.code === "cancelled").length;
    const active = all.length - done - cancelled;
    const rows = projects.map((p) => {
      const t = (tasksByProject[p.id] ?? []).filter((x) => x.status.code !== "backlog");
      const d = t.filter((x) => x.status.code === "done" || (x as { isDone?: boolean }).isDone).length;
      const o = t.filter((x) => x.isOverdue).length;
      return { project: p, tasks: t, done: d, cancelled: t.filter((x) => x.status.code === "cancelled").length, overdue: o, progress: p.progress ?? 0 };
    });
    return { projects, all, done, overdue, cancelled, active, total: all.length, rows };
  }, [projects, tasksByProject]);

  const progressSize = { width: 160, height: 20 };

  return (
    <div style={{ padding: "8px 24px 32px 24px", background: token.colorBgLayout, minHeight: "100vh" }}>
      <Spin spinning={loading}>
        <div style={{ marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0, fontSize: 28 }}>Обзор проектов</Title>
          <Text type="secondary" style={{ fontSize: 18 }}>Статистика по проектам и задачам</Text>
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={12} md={6}>
            <Card style={{ borderRadius: 12 }}>
              <Statistic title={<span style={{ fontSize: 20 }}>Проекты</span>} valueStyle={{ fontSize: 56, fontWeight: 700 }} value={projects.length} prefix={<ProjectFilled style={{ color: token.colorPrimary, fontSize: 28, marginRight: 14 }} />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card style={{ borderRadius: 12 }}>
              <Statistic title={<span style={{ fontSize: 20 }}>Задачи</span>} valueStyle={{ fontSize: 56, fontWeight: 700 }} value={stats.total} prefix={<UnorderedListOutlined style={{ color: token.colorInfo, fontSize: 28, marginRight: 14 }} />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card style={{ borderRadius: 12, borderLeft: `6px solid ${token.colorSuccess}` }}>
              <Statistic title={<span style={{ fontSize: 20 }}>Выполнено</span>} valueStyle={{ fontSize: 56, fontWeight: 700 }} value={stats.done} suffix={<span style={{ fontSize: 24 }}>/ {stats.total}</span>} prefix={<CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 28, marginRight: 14 }} />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card style={{ borderRadius: 12, borderLeft: `6px solid ${token.colorWarning}` }}>
              <Statistic title={<span style={{ fontSize: 20 }}>Просрочено</span>} valueStyle={{ fontSize: 56, fontWeight: 700 }} value={stats.overdue} prefix={<ClockCircleFilled style={{ color: stats.overdue > 0 ? token.colorError : token.colorWarning, fontSize: 28, marginRight: 14 }} />} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[20, 20]} style={{ marginTop: 24 }}>
          <Col xs={24} md={14}>
            <Card title={<span style={{ fontSize: 22 }}>Проекты</span>} style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
              {projects.length === 0 ? (
                <Empty description="Нет проектов" style={{ padding: 48 }} />
              ) : (
                <Table rowKey="id" dataSource={stats.rows} pagination={false} size="large" showHeader={false}
                  columns={[
                    {
                      key: "project",
                      render: (_, record: typeof stats.rows[number]) => {
                        const r = record;
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px 20px" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Link to={`/projects/${r.project.id}`} style={{ fontWeight: 700, fontSize: 20 }}>{`${r.project.code ? `[${r.project.code}] ` : ""}${r.project.name}`}</Link>
                              <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
                                <Text type="secondary" style={{ fontSize: 16 }}>Задач: {r.tasks.length}</Text>
                                <Text type="secondary" style={{ fontSize: 16 }}>Выполнено: {r.done}</Text>
                                {r.overdue > 0 && <Text type="danger" style={{ fontSize: 16 }}>Просрочек: {r.overdue}</Text>}
                              </div>
                            </div>
                            <Progress percent={r.progress} strokeWidth={14} style={{ ...progressSize }} />
                          </div>
                        );
                      },
                    },
                  ]}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} md={10}>
            <Card title={<span style={{ fontSize: 22 }}>Последние задачи</span>} style={{ borderRadius: 12 }} bodyStyle={{ padding: "0 20px" }}>
              {stats.all.length === 0 ? (
                <Empty description="Нет задач" style={{ padding: 48 }} />
              ) : (
                stats.all.slice(0, 5).map((task) => (
                  <div key={task.id} style={{ padding: "16px 0", borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong ellipsis style={{ display: "block", fontSize: 17 }}>{task.title}</Text>
                        <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                          <Tag style={{ fontSize: 14, padding: "2px 10px" }}>{statusLabel(task.status.code, task.status.name)}</Tag>
                          <Tag color={riskColor(task.priority)} style={{ fontSize: 14, padding: "2px 10px" }}>{task.isOverdue ? "Просрочено" : riskLabel(task.priority)}</Tag>
                        </div>
                      </div>
                      <Progress type="circle" percent={task.progress ?? 0} size={72} strokeWidth={10} style={{ flexShrink: 0 }} />
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
