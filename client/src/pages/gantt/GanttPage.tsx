import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { Button, Card, Progress, Select, Space, Table, Typography, Empty, Spin } from "antd";
import dayjs from "dayjs";
import { gqlQuery } from "@/api/graphql";

type Project = { id: string; code?: string; name: string; plannedStart?: string | null; plannedEnd?: string | null };
type ProjectOption = { id: string; code?: string; name: string };
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
  const { projectId: projectIdFromUrl } = useParams<{ projectId: string }>();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    gqlQuery<{ projects: ProjectOption[] }>("query { projects { id code name } }")
      .then((res) => {
        const projectList = res.projects ?? [];
        setProjects(projectList);
        setSelectedProjectId((current) => projectIdFromUrl || current || projectList[0]?.id || "");
      })
      .catch(() => setProjects([]));
  }, [projectIdFromUrl]);

  useEffect(() => {
    if (!selectedProjectId) return;
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
      { projectId: selectedProjectId }
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
  }, [selectedProjectId]);

  const selectedProject = project ?? projects.find((item) => item.id === selectedProjectId) ?? null;

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
      <Space style={{ marginBottom: 16 }} wrap>
        {projectIdFromUrl ? (
          <Link to={`/projects/${projectIdFromUrl}`}>
            <Button>← Назад к проекту</Button>
          </Link>
        ) : null}
        <Select
          style={{ minWidth: 360 }}
          value={selectedProjectId}
          onChange={(value) => setSelectedProjectId(value as string)}
          options={projects.map((item) => ({
            label: `${item.code ? `[${item.code}] ` : ""}${item.name}`,
            value: item.id,
          }))}
          placeholder="Выберите проект"
        />
        <Text strong>{selectedProject ? `${selectedProject.code ? `[${selectedProject.code}] ` : ""}${selectedProject.name}` : "Диаграмма Ганта"}</Text>
      </Space>

      <Spin spinning={loading}>
        {!selectedProject ? (
          <Empty description={projects.length === 0 ? "Нет проектов" : "Выберите проект для построения диаграммы"} />
        ) : (
          <Card title="Диаграмма Ганта">
            <div style={{ marginLeft: 360, marginBottom: 6, position: "relative", height: 48 }}>
              {renderTimelineScale(timeline.min, timeline.days)}
            </div>
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

function renderTimelineScale(min: dayjs.Dayjs, days: number) {
  const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  const max = min.add(days - 1, "day");
  const today = dayjs();
  const monthLabels: ReactNode[] = [];
  const dayLabels: ReactNode[] = [];
  let currentMonth = min.startOf("month");

  while (currentMonth.isBefore(max.add(1, "day"))) {
    const monthEnd = currentMonth.clone().endOf("month");
    const segmentStart = currentMonth.isBefore(min) ? min : currentMonth;
    const segmentEnd = monthEnd.isAfter(max) ? max : monthEnd;
    const left = Math.max(0, (segmentStart.diff(min, "day") / Math.max(days, 1)) * 100);
    const segmentDays = segmentEnd.diff(segmentStart, "day") + 1;
    const width = Math.max(4, (segmentDays / Math.max(days, 1)) * 100);
    monthLabels.push(
      <div
        key={`month-${currentMonth.format("YYYY-MM")}`}
        style={{
          position: "absolute",
          left: `${left}%`,
          top: 0,
          width: `${width}%`,
          textAlign: "center",
          color: "#595959",
          fontSize: 12,
          borderLeft: "1px solid #f0f0f0",
          lineHeight: "24px",
        }}
      >
        {monthNames[currentMonth.month()]}
      </div>
    );
    currentMonth = currentMonth.add(1, "month");
  }

  for (let index = 0; index < days; index += 1) {
    const date = min.add(index, "day");
    const isMonthStart = date.date() === 1;
    const isWeekTick = index % 7 === 0;
    const isToday = date.isSame(today, "day");
    const isEdge = index === 0 || index === days - 1;
    if (!isMonthStart && !isWeekTick && !isToday && !isEdge) continue;

    const left = (index / Math.max(days, 1)) * 100;
    dayLabels.push(
      <div
        key={`day-${date.format("YYYY-MM-DD")}`}
        style={{
          position: "absolute",
          left: `${left}%`,
          top: 24,
          color: isToday ? "#1677ff" : "#8c8c8c",
          fontSize: 11,
          transform: "translateX(-50%)",
        }}
      >
        {isToday ? "сегодня" : date.format("D")}
      </div>
    );
  }

  return [...monthLabels, ...dayLabels];
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
