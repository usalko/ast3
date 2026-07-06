import { useEffect, useState } from "react";
import { Table, Button, Space, Typography, Tag, Popconfirm, message, Tabs, Modal, Select, Input } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { gqlQuery } from "@/api/graphql";
import { statusLabel } from "@/utils/statusLabels";
import { riskLabel } from "@/utils/riskLabels";

const { Text } = Typography;

type Task = {
  id: string;
  code?: string;
  title: string;
  type?: string;
  progress?: number | null;
  priority?: number;
  status: { name: string; code: string; order?: number };
};

type ProjectOption = { id: string; code?: string; name: string };
type UserOption = { id: string; firstName: string; roles?: string[] };
type TaskStatus = { id: string; name: string; code: string };

const STATUS_ORDER: Record<string, number> = {
  in_progress: 1,
  todo: 2,
  backlog: 3,
  done: 4,
  cancelled: 5,
};

const ACTIVE_CODES = new Set(["todo", "in_progress"]);
const COMPLETED_CODES = new Set(["done", "cancelled"]);

export function TaskList() {
  const [data, setData] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("active");

  const [modalOpen, setModalOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>("");
  const [newTaskStatusId, setNewTaskStatusId] = useState<string>("");
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setLoading(true);
    gqlQuery<{ tasksAll: Task[] }>(
      `query { tasksAll { id code title type progress priority status { name code order } } }`
    )
      .then((res) => {
        const sorted = (res.tasksAll ?? []).sort(
          (a, b) => (STATUS_ORDER[a.status?.code] ?? 0) - (STATUS_ORDER[b.status?.code] ?? 0)
        );
        setData(sorted);
      })
      .finally(() => setLoading(false));

    gqlQuery<{ projects: ProjectOption[] }>("query { projects { id code name } }")
      .then((res) => setProjects(res.projects ?? []))
      .catch(() => {});

    gqlQuery<{ users: UserOption[] }>("query { users { id firstName roles } }")
      .then((res) => {
        setUsers((res.users ?? []).filter((u) => !(u.roles ?? []).includes("admin")));
      })
      .catch(() => {});
  }, []);

  async function handleDelete(taskId: string) {
    try {
      await gqlQuery(
        `mutation ($id: ID!) { deleteTask(id: $id) }`,
        { id: taskId }
      );
      setData((current) => current.filter((t) => t.id !== taskId));
      message.success("Задача удалена");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось удалить задачу${detail ? `: ${detail}` : ""}`);
    }
  }

  async function handleProjectChange(projectId: string) {
    setNewTaskProjectId(projectId);
    setNewTaskStatusId("");
    if (!projectId) {
      setStatuses([]);
      return;
    }
    try {
      const res = await gqlQuery<{ project: { statuses: TaskStatus[] } }>(
        `query ($id: ID!) { project(id: $id) { statuses { id name code } } }`,
        { id: projectId }
      );
      setStatuses((res.project?.statuses ?? []).filter((s) => s.code !== "backlog"));
    } catch {
      message.error("Не удалось загрузить статусы проекта");
    }
  }

  async function handleCreateTask() {
    if (!newTaskTitle.trim() || !newTaskProjectId || !newTaskStatusId) return;
    setCreating(true);
    try {
      const res = await gqlQuery<{ createTask: { id: string } }>(
        `mutation ($input: CreateTaskInput!) {
          createTask(input: $input) { id }
        }`,
        {
          input: {
            projectId: newTaskProjectId,
            title: newTaskTitle.trim(),
            statusId: newTaskStatusId,
          },
        }
      );
      if (newTaskAssigneeId && res.createTask?.id) {
        await gqlQuery(
          `mutation ($taskId: ID!, $userId: ID!) { addTaskAssignee(taskId: $taskId, userId: $userId) }`,
          { taskId: res.createTask.id, userId: newTaskAssigneeId }
        );
      }
      message.success("Задача создана");
      setModalOpen(false);
      setNewTaskTitle("");
      setNewTaskProjectId("");
      setNewTaskStatusId("");
      setNewTaskAssigneeId("");
      setStatuses([]);

      setLoading(true);
      gqlQuery<{ tasksAll: Task[] }>(
        `query { tasksAll { id code title type progress priority status { name code order } } }`
      )
        .then((res) => {
          const sorted = (res.tasksAll ?? []).sort(
            (a, b) => (STATUS_ORDER[a.status?.code] ?? 0) - (STATUS_ORDER[b.status?.code] ?? 0)
          );
          setData(sorted);
        })
        .finally(() => setLoading(false));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось создать задачу${detail ? `: ${detail}` : ""}`);
    } finally {
      setCreating(false);
    }
  }

  const filteredData = data.filter((t) =>
    tab === "active" ? ACTIVE_CODES.has(t.status?.code) : COMPLETED_CODES.has(t.status?.code)
  );

  const baseColumns = [
    {
      title: "Код",
      dataIndex: "code",
      key: "code",
      width: 200,
      render: (v?: string) => (v ? <Text code>{v}</Text> : "—"),
    },
    {
      title: "Название",
      dataIndex: "title",
      key: "title",
      render: (v: string, record: Task) => (
        <Link to={`/tasks/${record.id}/edit`}><Text strong>{v}</Text></Link>
      ),
    },
    {
      title: "Статус",
      key: "status",
      render: (_: unknown, record: Task) => (
        <Tag>{statusLabel(record.status?.code, record.status?.name)}</Tag>
      ),
    },
    {
      title: "Приоритет",
      dataIndex: "priority",
      key: "priority",
      render: (v?: number) => riskLabel(v),
    },
    {
      title: "Прогресс",
      dataIndex: "progress",
      key: "progress",
      render: (v?: number | null) => `${v ?? 0}%`,
    },
    {
      title: "Действия",
      key: "actions",
      render: (_: unknown, record: Task) => (
        <Space>
          <Link to={`/tasks/${record.id}/edit`}>
            <Button>Открыть</Button>
          </Link>
          <Popconfirm
            title="Удалить задачу?"
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button danger size="small">Удалить</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const columns = tab === "completed"
    ? baseColumns.filter((c) => c.key !== "progress")
    : baseColumns;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Tabs activeKey={tab} onChange={setTab} items={[
          { key: "active", label: "К выполнению / В работе" },
          { key: "completed", label: "Выполненные / Отменённые" },
        ]} style={{ marginBottom: 0 }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Добавить задачу
        </Button>
      </div>
      <Table<Task>
        rowKey="id"
        dataSource={filteredData}
        loading={loading}
        columns={columns}
        pagination={false}
      />

      <Modal
        title="Добавить задачу"
        open={modalOpen}
        onOk={handleCreateTask}
        onCancel={() => {
          setModalOpen(false);
          setNewTaskTitle("");
          setNewTaskProjectId("");
          setNewTaskStatusId("");
          setNewTaskAssigneeId("");
          setStatuses([]);
        }}
        confirmLoading={creating}
        okText="Создать"
        cancelText="Отмена"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <Text strong>Название задачи</Text>
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Введите название задачи"
              style={{ marginTop: 4 }}
            />
          </div>
          <div>
            <Text strong>Проект</Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              value={newTaskProjectId || undefined}
              onChange={handleProjectChange}
              placeholder="Выберите проект"
              options={projects.map((p) => ({
                label: `${p.code ? `[${p.code}] ` : ""}${p.name}`,
                value: p.id,
              }))}
            />
          </div>
          <div>
            <Text strong>Статус</Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              value={newTaskStatusId || undefined}
              onChange={(value) => setNewTaskStatusId(value as string)}
              placeholder="Выберите статус"
              disabled={!newTaskProjectId}
              options={statuses.map((s) => ({
                label: statusLabel(s.code, s.name),
                value: s.id,
              }))}
            />
          </div>
          <div>
            <Text strong>Исполнитель</Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              value={newTaskAssigneeId || undefined}
              onChange={(value) => setNewTaskAssigneeId(value as string)}
              placeholder="Выберите исполнителя (необязательно)"
              allowClear
              options={users.map((u) => ({
                label: u.firstName,
                value: u.id,
              }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
