import { useEffect, useMemo, useState } from "react";
import { Button, Card, Col, DatePicker, Form, Input, Row, Select, Space, Table, Tag, Typography, message, Alert } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { gqlQuery } from "@/api/graphql";
import { riskColor, riskLabel } from "@/utils/riskLabels";
import { statusLabel } from "@/utils/statusLabels";

type Project = { id: string; code?: string; name: string };
type User = { id: string; fullName?: string | null };
type TaskStatus = { id: string; name: string; code?: string };
type Task = {
  id: string;
  code?: string;
  title: string;
  progress?: number | null;
  estimatedHours?: number | null;
  priority?: number;
  isOverdue?: boolean | null;
  status: TaskStatus;
  assignee?: User | null;
};
type TimeEntry = {
  id: string;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  durationHours?: number | null;
  source: string;
  description?: string;
  task: { id: string; code?: string; title: string };
};
type ActiveTimer = TimeEntry & { id: string; startTime: string; task: { id: string; code?: string; title: string } };
type ManualEntryValues = {
  taskId: string;
  startTime: Dayjs;
  endTime: Dayjs;
  description?: string;
};

const { Text } = Typography;

export function TimeTrackingPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [teamEntries, setTeamEntries] = useState<TimeEntry[]>([]);
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);
  const [manualForm] = Form.useForm<ManualEntryValues>();

  useEffect(() => {
    gqlQuery<{ projects: Project[] }>("query { projects { id code name } }")
      .then((res) => {
        const projectList = res.projects ?? [];
        setProjects(projectList);
        setProjectId((current) => current || projectList[0]?.id || "");
      })
      .catch((err) => {
        const detail = err instanceof Error ? err.message : JSON.stringify(err);
        const messageText = `Не удалось загрузить проекты: ${detail}`;
        setErrorText(messageText);
        message.error(messageText);
      });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);

    void loadTasks(projectId);
    void loadMyEntries();
    void loadTeamEntries(projectId);
    void loadActiveTimers();

    async function loadTasks(project: string) {
      try {
        const res = await gqlQuery<{ tasks: Task[] }>(
          `query ($projectId: ID!) {
            tasks(projectId: $projectId) {
              id code title progress estimatedHours priority isOverdue status { id name } assignee { id fullName }
            }
          }`,
          { projectId: project }
        );
        setTasks(res.tasks ?? []);
      } catch (err) {
        const detail = err instanceof Error ? err.message : JSON.stringify(err);
        const messageText = `Не удалось загрузить задачи: ${detail}`;
        setErrorText(messageText);
        console.error("Tasks load error", err);
        message.error(messageText);
        setTasks([]);
      }
    }

    async function loadMyEntries() {
      try {
        const res = await gqlQuery<{ myTimeEntries: TimeEntry[] }>(
          `query { myTimeEntries { id startTime endTime durationMinutes durationHours source description task { id code title } } }`
        );
        setEntries(res.myTimeEntries ?? []);
      } catch (err) {
        const detail = err instanceof Error ? err.message : JSON.stringify(err);
        const messageText = `Не удалось загрузить мои записи: ${detail}`;
        setErrorText(messageText);
        console.error("My entries load error", err);
        message.error(messageText);
        setEntries([]);
      }
    }

    async function loadTeamEntries(project: string) {
      try {
        const res = await gqlQuery<{ timeEntries: TimeEntry[] }>(
          `query ($projectId: ID!) {
            timeEntries(projectId: $projectId, includeAll: true) {
              id startTime endTime durationMinutes durationHours source description task { id code title }
            }
          }`,
          { projectId: project }
        );
        setTeamEntries(res.timeEntries ?? []);
      } catch (err) {
        const detail = err instanceof Error ? err.message : JSON.stringify(err);
        const messageText = `Не удалось загрузить записи проекта: ${detail}`;
        setErrorText(messageText);
        console.error("Team entries load error", err);
        message.error(messageText);
        setTeamEntries([]);
      }
    }

    async function loadActiveTimers() {
      try {
        const res = await gqlQuery<{ activeTimers: ActiveTimer[] }>(
          `query { activeTimers { id startTime durationHours task { id code title } } }`
        );
        setActiveTimers(res.activeTimers ?? []);
      } catch (err) {
        const detail = err instanceof Error ? err.message : "";
        const messageText = `Не удалось загрузить активные таймеры${detail ? `: ${detail}` : ""}`;
        setErrorText(messageText);
        console.error("Active timers load error", err);
        message.error(messageText);
        setActiveTimers([]);
      } finally {
        setLoading(false);
      }
    }
  }, [projectId]);

  const visibleTasks = useMemo(
    () => tasks.filter((t) => !activeTimers.some((tm) => tm.task.id === t.id)),
    [tasks, activeTimers]
  );

  const taskOptions = useMemo(
    () => visibleTasks.map((task) => ({
      label: `${task.code ? `[${task.code}] ` : ""}${task.title}`,
      value: task.id,
    })),
    [visibleTasks]
  );

  const totals = useMemo(() => {
    const grouped = new Map<string, { task: Task; minutes: number }>();
    for (const entry of teamEntries) {
      const task = tasks.find((item) => item.id === entry.task.id);
      if (!task) continue;
      const current = grouped.get(task.id) ?? { task, minutes: 0 };
      current.minutes += entry.durationMinutes ?? Math.round((entry.durationHours ?? 0) * 60);
      grouped.set(task.id, current);
    }
    return [...grouped.values()].sort((a, b) => b.minutes - a.minutes);
  }, [tasks, teamEntries]);

  async function startTimer(taskId: string) {
    try {
      const res = await gqlQuery<{ startTimer: ActiveTimer }>(
        `mutation ($taskId: ID!) { startTimer(taskId: $taskId) { id startTime durationHours task { id code title } } }`,
        { taskId }
      );
      setActiveTimers((current) => [res.startTimer, ...current]);
      setTasks((current) => current.filter((t) => t.id !== taskId));
      message.success("Таймер запущен");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось запустить таймер${detail ? `: ${detail}` : ""}`);
    }
  }

  async function stopTimer(timerId: string) {
    try {
      const res = await gqlQuery<{ stopTimer: ActiveTimer }>(
        `mutation ($id: ID!) { stopTimer(id: $id) { id startTime endTime durationMinutes durationHours task { id code title } } }`,
        { id: timerId }
      );
      setActiveTimers((current) => current.filter((item) => item.id !== timerId));
      setEntries((current) => [res.stopTimer, ...current]);
      // Re-fetch the task to add it back to visible list
      const taskRes = await gqlQuery<{ task: Task }>(
        `query ($id: ID!) { task(id: $id) { id code title progress estimatedHours priority isOverdue status { id name } assignee { id fullName } } }`,
        { id: res.stopTimer.task.id }
      );
      if (taskRes?.task) {
        setTasks((current) => current.some((t) => t.id === taskRes.task.id) ? current : [...current, taskRes.task]);
      }
      message.success("Таймер остановлен");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось остановить таймер${detail ? `: ${detail}` : ""}`);
    }
  }

  async function handleManualSubmit(values: ManualEntryValues) {
    try {
      const res = await gqlQuery<{ createManualEntry: TimeEntry }>(
        `mutation ($taskId: ID!, $startTime: DateTime!, $endTime: DateTime!, $description: String!) {
          createManualEntry(taskId: $taskId, startTime: $startTime, endTime: $endTime, description: $description) {
            id startTime endTime durationMinutes durationHours source description task { id code title }
          }
        }`,
        {
          taskId: values.taskId,
          startTime: values.startTime.toISOString(),
          endTime: values.endTime.toISOString(),
          description: values.description || "",
        }
      );
      manualForm.resetFields();
      setEntries((current) => [res.createManualEntry, ...current]);
      message.success("Запись времени создана");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось создать запись${detail ? `: ${detail}` : ""}`);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      {errorText ? <Alert message="Ошибка загрузки" description={errorText} type="error" showIcon style={{ marginBottom: 16 }} /> : null}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title="Учёт рабочего времени"
            extra={
              <Select
                style={{ minWidth: 320 }}
                value={projectId}
                onChange={(value) => setProjectId(value as string)}
                options={projects.map((project) => ({
                  label: `${project.code ? `[${project.code}] ` : ""}${project.name}`,
                  value: project.id,
                }))}
                placeholder="Выберите проект"
              />
            }
          >
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              {activeTimers.length === 0 ? (
                <Card type="inner">Активные таймеры отсутствуют. Выберите задачу и нажмите «Старт».</Card>
              ) : (
                activeTimers.map((timer) => (
                  <Card type="inner" key={timer.id}>
                    <Space wrap>
                      <Text strong>Таймер:</Text>
                      <Text code>{timer.task.code}</Text>
                      <Text>{timer.task.title}</Text>
                      <Tag color="green">запущен {formatDateTime(timer.startTime)}</Tag>
                      <Button onClick={() => stopTimer(timer.id)}>Остановить</Button>
                    </Space>
                  </Card>
                ))
              )}
            </Space>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="Задачи проекта" loading={loading}>
            <Table
              rowKey="id"
              dataSource={visibleTasks}
              pagination={false}
              size="small"
              columns={[
                { title: "Код", dataIndex: "code", key: "code", render: (value?: string) => value ? <Text code>{value}</Text> : "—" },
                { title: "Название", dataIndex: "title", key: "title", render: (value: string, record: Task) => (
                  <Space direction="vertical" size={2}>
                    <Text strong>{value}</Text>
                    <Text type="secondary">{record.assignee?.fullName ?? "Без исполнителя"}</Text>
                  </Space>
                ) },
                { title: "Статус", dataIndex: ["status", "name"], key: "status", render: (value: string | undefined, record: Task) => <Tag>{statusLabel(record.status.code, value ?? record.status.name)}</Tag> },
                { title: "Прогресс", dataIndex: "progress", key: "progress", render: (value?: number) => `${value ?? 0}%` },
                { title: "Приоритет", dataIndex: "priority", key: "risk", render: (value: number | undefined, record: Task) => <Tag color={riskColor(value)}>{record.isOverdue ? "Просрочено" : riskLabel(value)}</Tag> },
                { title: "Учёт", key: "actions", render: (_: unknown, record: Task) => <Button size="small" onClick={() => startTimer(record.id)}>Старт</Button> },
              ]}
            />
          </Card>
        </Col>

        <Col span={12}>
          <Card title="Ручная запись времени">
            <Form form={manualForm} layout="vertical" onFinish={handleManualSubmit}>
              <Form.Item name="taskId" label="Задача" rules={[{ required: true, message: "Выберите задачу" }]}>
                <Select placeholder="Выберите задачу" options={taskOptions} disabled={taskOptions.length === 0} />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="startTime" label="Начало" rules={[{ required: true, message: "Укажите начало" }]}>
                    <DatePicker showTime style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="endTime" label="Конец" rules={[{ required: true, message: "Укажите конец" }]}>
                    <DatePicker showTime style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="description" label="Описание">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Button type="primary" htmlType="submit">Создать запись</Button>
            </Form>
          </Card>

          <Card title="Итого по задачам" style={{ marginTop: 16 }}>
            <Table
              rowKey={(record) => record.task.id}
              dataSource={totals}
              pagination={false}
              size="small"
              columns={[
                { title: "Задача", dataIndex: ["task", "title"], key: "task" },
                { title: "Часы", dataIndex: "minutes", key: "minutes", render: (value: number) => (value / 60).toFixed(1) },
              ]}
            />
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Мои записи времени" loading={loading}>
            <Table
              rowKey="id"
              dataSource={entries}
              pagination={{ pageSize: 8 }}
              size="small"
              columns={[
                { title: "Время", dataIndex: "startTime", key: "startTime", render: (value: string, record: TimeEntry) => `${formatDateTime(value)} — ${formatDateTime(record.endTime ?? "")}` },
                { title: "Задача", dataIndex: ["task", "title"], key: "task", render: (value: string, record: TimeEntry) => (
                  <Space direction="vertical" size={2}>
                    <Text code>{record.task.code}</Text>
                    <Text>{value}</Text>
                  </Space>
                ) },
                { title: "Источник", dataIndex: "source", key: "source", render: (value: string) => value === "timer" ? "Таймер" : "Вручную" },
                { title: "Часы", dataIndex: "durationHours", key: "durationHours", render: (value: number | undefined, record: TimeEntry) => (value ?? (record.durationMinutes ?? 0) / 60).toFixed(1) },
                { title: "Описание", dataIndex: "description", key: "description", ellipsis: true },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function formatDateTime(value: string) {
  return value ? dayjs(value).format("DD.MM.YYYY HH:mm") : "—";
}
