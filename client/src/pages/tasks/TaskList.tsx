import { useEffect, useState } from "react";
import { Table, Button, Space, Typography, Popconfirm, message, Tabs, Modal, Select, Input, DatePicker } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { gqlQuery } from "@/api/graphql";

const { Text } = Typography;

type Task = {
  id: string;
  code?: string;
  title: string;
  type?: string;
  progress?: number | null;
  priority?: number;
  comment?: string;
  createdAt?: string;
  status: { name: string; code: string; order?: number };
  assignees?: { firstName?: string | null }[] | null;
  project?: { id: string; code: string; name: string } | null;
  comments?: TaskComment[] | null;
};

type ProjectOption = { id: string; code?: string; name: string };
type UserOption = { id: string; firstName: string; roles?: string[] };
type TaskComment = { id: string; authorName: string; body: string; number: number; createdAt: string };

const STATUS_ORDER: Record<string, number> = {
  in_progress: 1,
  todo: 2,
  backlog: 3,
  done: 4,
  cancelled: 5,
};

const ACTIVE_CODES = new Set(["todo", "in_progress"]);
const COMPLETED_CODES = new Set(["done", "cancelled"]);

const formatCommentBody = (body: string): string => {
  const match = body.match(/^(\d{2}\.\d{2})\.\d{4}\s/);
  if (match) {
    return body.replace(/^\d{2}\.\d{2}\.\d{4}/, match[1]);
  }
  return body;
};

export function TaskList() {
  const [data, setData] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("active");

  const [modalOpen, setModalOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>("");
  const [newTaskStatusId, setNewTaskStatusId] = useState<string>("");
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTaskId, setCommentTaskId] = useState<string>("");
  const [commentDate, setCommentDate] = useState<Dayjs>(dayjs());
  const [commentText, setCommentText] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [taskComments, setTaskComments] = useState<Record<string, TaskComment[]>>({});

  async function loadAllComments(tasks: Task[]) {
    const map: Record<string, TaskComment[]> = {};
    await Promise.all(
      tasks.map(async (t) => {
        try {
          const res = await gqlQuery<{ taskComments: TaskComment[] }>(
            `query ($taskId: ID!) { taskComments(taskId: $taskId) { id authorName body number createdAt } }`,
            { taskId: t.id }
          );
          map[t.id] = res.taskComments ?? [];
        } catch {
          map[t.id] = [];
        }
      })
    );
    setTaskComments(map);
  }

  async function fetchTasks() {
    setLoading(true);
    try {
      try {
        const res = await gqlQuery<{ tasksAll: Task[] }>(
          `query { tasksAll { id code title type progress priority comment createdAt status { name code order } assignees { firstName } project { id code name } comments { id authorName body number createdAt } } }`
        );
        const sorted = (res.tasksAll ?? []).sort(
          (a, b) => (STATUS_ORDER[a.status?.code] ?? 0) - (STATUS_ORDER[b.status?.code] ?? 0)
        );
        setData(sorted);
      } catch {
        const res = await gqlQuery<{ tasksAll: Task[] }>(
          `query { tasksAll { id code title type progress priority comment createdAt status { name code order } assignees { firstName } project { id code name } } }`
        );
        const sorted = (res.tasksAll ?? []).sort(
          (a, b) => (STATUS_ORDER[a.status?.code] ?? 0) - (STATUS_ORDER[b.status?.code] ?? 0)
        );
        setData(sorted);
        await loadAllComments(sorted);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTasks();

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
    if (!projectId) {
      setNewTaskStatusId("");
      return;
    }
    try {
      const res = await gqlQuery<{ project: { statuses: TaskStatus[] } }>(
        `query ($id: ID!) { project(id: $id) { statuses { id name code } } }`,
        { id: projectId }
      );
      const todoStatus = (res.project?.statuses ?? []).find((s) => s.code === "todo");
      if (todoStatus) {
        setNewTaskStatusId(todoStatus.id);
      } else {
        message.error("У проекта нет статуса «К выполнению»");
      }
    } catch {
      message.error("Не удалось загрузить статусы проекта");
    }
  }

  async function handleSaveComment() {
    if (!commentText.trim()) return;
    setSavingComment(true);
    try {
      const dateStr = commentDate.format("DD.MM.YYYY HH:mm");
      await gqlQuery(
        `mutation ($input: CreateCommentInput!) { createComment(input: $input) { id } }`,
        { input: { taskId: commentTaskId, body: `${dateStr}              ${commentText.trim()}` } }
      );
      message.success("Комментарий добавлен");
      setCommentModalOpen(false);
      setCommentText("");
      await fetchTasks();
    } catch (err: any) {
      const graphqlErrors = err?.response?.errors?.map((e: any) => e.message).join(", ");
      const detail = graphqlErrors || (err instanceof Error ? err.message : "");
      message.error(`Не удалось добавить комментарий${detail ? `: ${detail}` : ""}`);
    } finally {
      setSavingComment(false);
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

      await fetchTasks();
    } catch (err: any) {
      const graphqlErrors = err?.response?.errors?.map((e: any) => e.message).join(", ");
      const detail = graphqlErrors || (err instanceof Error ? err.message : "");
      message.error(`Не удалось создать задачу${detail ? `: ${detail}` : ""}`);
    } finally {
      setCreating(false);
    }
  }

  const filteredActive = data.filter((t) => ACTIVE_CODES.has(t.status?.code));

  const groupedActive = filteredActive.reduce<Record<string, { project: { id: string; code: string; name: string }; tasks: Task[] }>>((acc, task) => {
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

  const activeProjectGroups = Object.values(groupedActive).sort((a, b) =>
    a.project.name.localeCompare(b.project.name)
  );

  const activeFlatData = activeProjectGroups.flatMap((g) =>
    g.tasks.map((t, i) => ({ ...t, _projectName: g.project.code ? `[${g.project.code}] ${g.project.name}` : g.project.name, _isFirst: i === 0 }))
  );

  const filteredCompleted = data.filter((t) => COMPLETED_CODES.has(t.status?.code));

  const completedSorted = [...filteredCompleted].sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || "")
  );

  const completedFlatData = completedSorted.map((t, i) => ({
    ...t,
    _rowNum: i + 1,
  }));

  const activeColumns = [
    {
      title: "Название",
      dataIndex: "title",
      key: "title",
      width: "30%",
      sorter: undefined as unknown,
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
      title: "",
      key: "in_work",
      width: 22,
      render: (_: unknown, record: Task) =>
        record.status?.code === "in_progress" ? (
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: "red",
            }}
          />
        ) : null,
    },
    {
      title: "Комментарий",
      key: "comment",
      render: (_: unknown, record: Task & { _projectName?: string; _isFirst?: boolean }) => {
        const comments = (record.comments ?? taskComments[record.id]) ?? [];
        if (comments.length === 0) return "—";
        return (
          <div style={{ fontSize: 12 }}>
            {comments.map((c) => (
              <div key={c.id} style={{ marginBottom: 8, whiteSpace: "pre-wrap" }}>
                {c.number}. {formatCommentBody(c.body)}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      title: "Исполнитель",
      key: "assignee",
      width: 120,
      align: "right" as const,
      render: (_: unknown, record: Task) =>
        (record.assignees ?? []).map((a) => a.firstName).join(", ") || "—",
    },
    {
      title: "Действия",
      key: "actions",
      width: 280,
      align: "right" as const,
      render: (_: unknown, record: Task) => (
        <Space>
          <Link to={`/tasks/${record.id}/edit`}>
            <Button>Открыть</Button>
          </Link>
          <Button onClick={() => {
            setCommentTaskId(record.id);
            setCommentDate(dayjs());
            setCommentText("");
            setCommentModalOpen(true);
          }}>Добавить комментарий</Button>
          <Popconfirm
            title="Удалить задачу?"
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small">Удалить</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const completedColumns = [
    {
      title: "№",
      key: "rowNum",
      width: 50,
      render: (_: unknown, record: Task & { _rowNum?: number }) =>
        <Text type="secondary">{record._rowNum}</Text>,
    },
    {
      title: "Дата",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      render: (v: string) => v ? dayjs(v).format("DD.MM.YYYY") : "—",
    },
    {
      title: "Задача",
      dataIndex: "title",
      key: "title",
      render: (v: string, record: Task) => (
        <Link to={`/tasks/${record.id}/edit`}><Text strong>{v}</Text></Link>
      ),
    },
    {
      title: "Проект",
      key: "project",
      width: 100,
      render: (_: unknown, record: Task) =>
        record.project?.code || record.project?.name || "—",
    },
    {
      title: "Комментарий",
      key: "comment",
      render: (_: unknown, record: Task) => {
        const comments = (record.comments ?? taskComments[record.id]) ?? [];
        if (comments.length === 0) return "—";
        return (
          <div style={{ fontSize: 12 }}>
            {comments.map((c) => (
              <div key={c.id} style={{ marginBottom: 8, whiteSpace: "pre-wrap" }}>
                {c.number}. {formatCommentBody(c.body)}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 80,
      render: (_: unknown, record: Task) => (
        <Link to={`/tasks/${record.id}/edit`}>
          <Button size="small">Открыть</Button>
        </Link>
      ),
    },
  ];

  return (
    <div style={{ padding: 16, maxWidth: "100%", overflow: "hidden" }}>
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
      ) : tab === "active" ? (
        <Table<Task & { _projectName?: string; _isFirst?: boolean }>
          rowKey="id"
          dataSource={activeFlatData}
          columns={activeColumns}
          pagination={false}
          size="small"
          tableLayout="auto"
          rowClassName={(_: Task, index: number) => {
            if (index > 0 && activeFlatData[index]?._isFirst) return "project-divider";
            return "";
          }}
        />
      ) : (
        <Table<Task & { _rowNum?: number }>
          rowKey="id"
          dataSource={completedFlatData}
          columns={completedColumns}
          pagination={false}
          size="small"
          tableLayout="auto"
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
        }}
        okButtonProps={{ disabled: !newTaskTitle.trim() || !newTaskProjectId || !newTaskStatusId, loading: creating }}
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
              maxLength={250}
              showCount
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

      <Modal
        title="Добавить комментарий"
        open={commentModalOpen}
        onOk={handleSaveComment}
        onCancel={() => {
          setCommentModalOpen(false);
          setCommentText("");
        }}
        okButtonProps={{ disabled: !commentText.trim(), loading: savingComment }}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <Text strong>Дата</Text>
            <DatePicker
              showTime={{ format: "HH:mm" }}
              format="DD.MM.YYYY HH:mm"
              value={commentDate}
              onChange={(v) => setCommentDate(v ?? dayjs())}
              style={{ width: "100%", marginTop: 4 }}
            />
          </div>
          <div>
            <Text strong>Комментарий</Text>
            <Input.TextArea
              rows={4}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Введите текст комментария..."
              style={{ marginTop: 4 }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
