import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button, Card, Progress, Space, Table, Typography, Empty, Spin } from "antd";
import dayjs from "dayjs";
import { gqlQuery } from "@/api/graphql";

type Project = { id: string; code?: string; name: string; plannedStart?: string | null; plannedEnd?: string | null };
type TaskStatus = { id: string; name: string; color?: string | null };
type User = { id: string; fullName?: string | null };
type Dependency = {
  id: string;
  type: string;
  predecessor: { id: string; code?: string; title: string };
  successor: { id: string; code?: string; title: string };
};
type Task = {
  id: string;
  code?: string;
  title: string;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  progress?: number | null;
  status: TaskStatus;
  assignee?: User | null;
  dependencies?: Dependency[];
};

const { Text } = Typography;

export function GanttPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    gqlQuery<{ project: Project; tasks: Task[] }>(
      `query ($projectId: ID!) {
        project(id: $projectId) { id code name plannedStart plannedEnd }
        tasks(projectId: $projectId) {
          id code title plannedStart plannedEnd progress status { id name color }
          assignee { id fullName }
          dependencies { id type predecessor { id code title } successor { id code title } }
        }
      }`,
      { projectId }
    )
      .then((res) => {
        setProject(res.project ?? null);
        setTasks(res.tasks ?? []);
      })
      .catch(() => {
        setProject(null);
        setTasks([]);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const timeline = useMemo(() => {
    const start = project?.plannedStart ? dayjs(project.plannedStart) : dayjs();
    const end = project?.plannedEnd ? dayjs(project.plannedEnd) : start.add(30, "day");
    const starts = [start, ...tasks.map((task) => dayjs(task.plannedStart || start))];
    const ends = [end, ...tasks.map((task) => dayjs(task.plannedEnd || end))];
    const min = starts.reduce((current, item) => (item.isBefore(current) ? item : current));
    const max = ends.reduce((current, item) => (item.isAfter(current) ? item : current));
    const days = Math.max(1, max.diff(min, "day") + 1);
    return { min, max, days };
  }, [project, tasks]);

  const rows = tasks
    .filter((task) => task.plannedStart || task.plannedEnd)
    .map((task) => {
      const start = dayjs(task.plannedStart || timeline.min);
      const end = dayjs(task.plannedEnd || start.add(1, "day"));
      const left = Math.max(0, start.diff(timeline.min, "day"));
      const width = Math.max(2, end.diff(start, "day") + 1);
      return { task, left, width };
    });

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 16 }}>
        <Link to={`/projects/${projectId}`}>
          <Button>← Назад к проекту</Button>
        </Link>
        <Text strong>{project ? `${project.code ? `[${project.code}] ` : ""}${project.name}` : "Диаграмма Ганта"}</Text>
      </Space>

      <Spin spinning={loading}>
        {!project ? (
          <Empty description="Проект не найден" />
        ) : (
          <Card title="Диаграмма Ганта">
            <Table
              rowKey={(record) => record.task.id}
              dataSource={rows}
              pagination={false}
              size="small"
              columns={[
                {
                  title: "Задача",
                  key: "task",
                  width: 360,
                  render: (_, record) => (
                    <Space direction="vertical" size={2}>
                      <Space wrap>
                        <Text code>{record.task.code}</Text>
                        <Text strong>{record.task.title}</Text>
                      </Space>
                      <Text type="secondary">
                        {record.task.assignee?.fullName ?? "Без исполнителя"} · {record.task.status.name}
                      </Text>
                      <Text type="secondary">
                        {formatDate(record.task.plannedStart)} — {formatDate(record.task.plannedEnd)}
                      </Text>
                    </Space>
                  ),
                },
                {
                  title: "Срок",
                  key: "timeline",
                  render: (_, record) => renderTimelineBar(record.left, record.width, timeline.days, record.task),
                },
                {
                  title: "Прогресс",
                  key: "progress",
                  width: 160,
                  render: (_, record) => <Progress percent={record.task.progress ?? 0} size="small" />,
                },
              ]}
            />
          </Card>
        )}
      </Spin>
    </div>
  );
}

function renderTimelineBar(left: number, width: number, totalDays: number, task: Task) {
  const leftPercent = Math.min(100, (left / Math.max(totalDays, 1)) * 100);
  const widthPercent = Math.min(100 - leftPercent, Math.max(2, (width / Math.max(totalDays, 1)) * 100));
  return (
    <div
      style={{
        position: "relative",
        height: 34,
        borderRadius: 6,
        background: "repeating-linear-gradient(90deg, #f0f0f0 0, #f0f0f0 1px, transparent 1px, transparent 14.285%)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: `${leftPercent}%`,
          top: 8,
          width: `${widthPercent}%`,
          height: 16,
          borderRadius: 8,
          backgroundColor: task.status.color || "#1677ff",
          opacity: 0.85,
        }}
        title={`${task.title}: ${formatDate(task.plannedStart)} — ${formatDate(task.plannedEnd)}`}
      />
    </div>
  );
}

function formatDate(value?: string | null) {
  return value ? dayjs(value).format("DD.MM.YYYY") : "—";
}
