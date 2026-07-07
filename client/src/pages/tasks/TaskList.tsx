import { useEffect, useState } from "react";
import { Table, Button, Space, Typography, Tag, Popconfirm, message, Tabs, Modal, Select, Input } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { gqlQuery } from "@/api/graphql";
import { statusLabel } from "@/utils/statusLabels";

const { Text } = Typography;

type Task = {
  id: string;
  code?: string;
  title: string;
  type?: string;
  progress?: number | null;
  priority?: number;
  comment?: string;
  status: { name: string; code: string; order?: number };
  assignees?: { firstName?: string | null }[] | null;
  project?: { id: string; code: string; name: string } | null;
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
        `query { tasksAll { id code title type progress priority comment status { name code order } assignees { firstName } project { id code name } } }`
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
      `query { tasksAll { id code title type progress priority comment status { name code order } assignees { firstName } project { id code name } } }`
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

  const groupedByProject = filteredData.reduce<Record<string, { project: { id: string; code: string; name: string }; tasks: Task[] }>>((acc, task) => {
    const p = task.project;
    const key = p?.id ?? "__none__";
    if (!acc[key]) {
      acc[key] = {
        project: p ?? { id: "__none__", code: "", name: "Без проекта" },
        tasks: [],
      };
    }
    acc[key].tasks.push(task);
    return acc;
  }, {});

  const projectGroups = Object.values(groupedByProject).sort((a, b) =>
    a.project.name.localeCompare(b.project.name)
  );

  const projectFlatData = projectGroups.flatMap((g) =>
    g.tasks.map((t, i) => ({ ...t, _projectName: g.project.code ? `[${g.project.code}] ${g.project.name}` : g.project.name, _isFirst: i === 0 }))
  );

  const baseColumns = [
    {
      title: "Название",
      dataIndex: "title",
      key: "title",
      sorter: undefined as unknown,
      onCell: (_: Task, index?: number) => {
        const idx = index ?? 0;
        const isFirst = projectFlatData[idx]?._isFirst;
        return isFirst ? { style: { paddingTop: 8, borderTop: "2px solid #f0f0f0" } } : {};
      },
      render: (v: string, record: Task & { _projectName?: string; _isFirst?: boolean }) => (
         <>
          {record._isFirst && (
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 2 }}>
              {record._projectName}
            </Text>
          )}
          <Link to={`/tasks/${record.id}/edit`}><Text strong>{v}</Text></Link>
        </>
      ),
    },
    {
      title: "Комментарий",
      dataIndex: "comment",
      key: "comment",
      width: 300,
      ellipsis: true,
      onCell: (_: Task, index?: number) =>
        projectFlatData[index ?? 0]?._isFirst ? { style: { paddingTop: 8 } } : {},
      render: (v?: string) => v || "—",
    },
    {
      title: "Статус",
      key: "status",
      width: 130,
      onCell: (_: Task, index?: number) =>
        projectFlatData[index ?? 0]?._isFirst ? { style: { paddingTop: 8 } } : {},
      render: (_: unknown, record: Task) => (
        <Tag>{statusLabel(record.status?.code, record.status?.name)}</Tag>
      ),
    },
    {
      title: "Исполнитель",
      key: "assignee",
      width: 130,
      onCell: (_: Task, index?: number) =>
        projectFlatData[index ?? 0]?._isFirst ? { style: { paddingTop: 8 } } : {},
      render: (_: unknown, record: Task) =>
        (record.assignees ?? []).map((a) => a.firstName).join(", ") || "—",
    },
    {
      title: "Действия",
      key: "actions",
      width: 160,
      onCell: (_: Task, index?: number) =>
        projectFlatData[index ?? 0]?._isFirst ? { style: { paddingTop: 8 } } : {},
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
      {loading ? (
        <Text type="secondary">Загрузка...</Text>
      ) : (
        <Table<Task & { _projectName?: string; _isFirst?: boolean }>
          rowKey="id"
          dataSource={projectFlatData}
          columns={baseColumns}
          pagination={false}
          size="small"
        />
      )}

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
