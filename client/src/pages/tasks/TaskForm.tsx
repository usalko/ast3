import { useEffect, useRef, useState } from "react";
import { Form, Input, Button, DatePicker, InputNumber, Card, message, Select, List, Typography, Space, Modal, Row, Col, Popconfirm } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { gqlQuery } from "@/api/graphql";
import { statusLabel } from "@/utils/statusLabels";

type Task = {
  id?: string;
  title?: string;
  description?: string;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  estimatedHours?: number | null;
  projectId?: string;
  statusId?: string;
  type?: string;
  progress?: number;
  priority?: number;
  comment?: string;
  assigneeIds?: string[];
};
type TaskFormValues = Omit<Task, "plannedStart" | "plannedEnd"> & {
  plannedStart?: Dayjs | null;
  plannedEnd?: Dayjs | null;
};
type User = { id: string; firstName: string };
type TaskStatus = { id: string; name: string; code: string };
type ProjectOption = { id: string; code?: string; name: string };
type TaskComment = { id: string; authorName: string; body: string; number: number; createdAt: string };

export function TaskForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const [formValid, setFormValid] = useState(!!id);
  const existingIdsRef = useRef<string[]>([]);

  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentDate, setCommentDate] = useState<Dayjs>(dayjs());
  const [commentText, setCommentText] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [editingComment, setEditingComment] = useState<TaskComment | null>(null);
  const [editCommentDate, setEditCommentDate] = useState<Dayjs>(dayjs());
  const [editCommentBody, setEditCommentBody] = useState("");

  const loadComments = async () => {
    if (!id) return;
    try {
      const res = await gqlQuery<{ taskComments: TaskComment[] }>(
        `query ($taskId: ID!) { taskComments(taskId: $taskId) { id authorName body number createdAt } }`,
        { taskId: id }
      );
      setComments(res.taskComments ?? []);
    } catch {
      setComments([]);
    }
  };

  const checkFormValid = () => {
    if (id) return;
    const vals = form.getFieldsValue();
    setFormValid(!!vals.projectId && !!vals.statusId && !!vals.title?.trim());
  };

  const loadStatuses = async (projectId: string) => {
    if (!projectId) {
      setStatuses([]);
      form.setFieldValue("statusId", undefined);
      return;
    }
    try {
      const res = await gqlQuery<{ project: { statuses: TaskStatus[] } }>(
        `query ($id: ID!) { project(id: $id) { statuses { id name code } } }`,
        { id: projectId }
      );
      const filtered = (res.project?.statuses ?? []).filter((s) => s.code !== "backlog");
      setStatuses(filtered);
      if (!id) {
        const todoStatus = filtered.find((s) => s.code === "todo");
        form.setFieldValue("statusId", todoStatus?.id);
        checkFormValid();
      }
    } catch {
      message.error("Не удалось загрузить статусы проекта");
    }
  };

  const projectId = Form.useWatch("projectId", form);

  useEffect(() => {
    if (projectId) {
      loadStatuses(projectId);
    }
  }, [projectId]);

  useEffect(() => {
    if (!id) return;
    gqlQuery<{ task: Task & { assigneeIds?: string[] } }>(`query ($id: ID!) { task(id: $id) { id title description plannedStart plannedEnd estimatedHours projectId statusId assigneeIds type progress priority comment } }`, { id }).then(async (res) => {
      const t = res.task;
      const ids = t.assigneeIds ?? [];
      existingIdsRef.current = ids;
      form.setFieldsValue({
        ...t,
        assigneeIds: ids,
        plannedStart: t?.plannedStart ? dayjs(t.plannedStart) : undefined,
        plannedEnd: t?.plannedEnd ? dayjs(t.plannedEnd) : undefined,
      });
    }).catch((err) => {
      console.error("[TaskForm] failed to load task:", err);
    });
    loadComments();
  }, [id, form]);

  useEffect(() => {
    gqlQuery<{ projects: ProjectOption[] }>(`query { projects { id code name } }`)
      .then((res) => setProjects(res.projects ?? []))
      .catch(() => setProjects([]));
  }, [id]);

  useEffect(() => {
     gqlQuery<{ users: { id: string; firstName: string; roles?: string[] }[] }>(`query { users { id firstName roles } }`)
      .then((res) => {
        const list = (res.users ?? []).filter((u) => !(u.roles ?? []).includes("admin"));
        setUsers(list);
        if (id && existingIdsRef.current.length > 0) {
          form.setFieldsValue({ assigneeIds: existingIdsRef.current });
        }
      })
      .catch(() => setUsers([]));
  }, []);

  async function onFinish(values: TaskFormValues) {
    setSaving(true);
    try {
      const input: Record<string, unknown> = {
        title: values.title,
        description: values.description || "",
        plannedStart: values.plannedStart ? values.plannedStart.toISOString() : null,
        plannedEnd: values.plannedEnd ? values.plannedEnd.toISOString() : null,
        estimatedHours: values.estimatedHours != null ? Number(values.estimatedHours) : null,
        projectId: values.projectId,
        statusId: values.statusId,
        type: values.type,
        priority: values.priority != null ? Math.round(Number(values.priority)) : 1,
        comment: values.comment || "",
      };

      const projectId = values.projectId;

      if (id) {
        input.progress = values.progress;
        await gqlQuery(`mutation ($id: ID!, $input: UpdateTaskInput!) { updateTask(id: $id, input: $input) { id } }`, { id, input });
      } else {
        const createInput = { ...input, projectId };
        await gqlQuery(`mutation ($input: CreateTaskInput!) { createTask(input: $input) { id } }`, { input: createInput });
      }

      if (id) {
        const uid = values.assigneeIds !== undefined ? values.assigneeIds : existingIdsRef.current;
        await gqlQuery(`mutation ($taskId: ID!, $userIds: [ID!]!) { setTaskAssignees(taskId: $taskId, userIds: $userIds) }`, {
          taskId: id,
          userIds: uid,
        });
      }

      message.success(id ? "Задача обновлена" : "Задача создана");
      navigate(`/projects/${projectId}`);
    } catch (err: any) {
      const graphqlErrors = err?.response?.errors?.map((e: any) => e.message).join(", ");
      const detail = graphqlErrors || (err instanceof Error ? err.message : "");
      message.error(`Ошибка при сохранении задачи${detail ? `: ${detail}` : ""}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveComment() {
    if (!id || !commentText.trim()) return;
    setSavingComment(true);
    try {
      const dateStr = commentDate.format("DD.MM.YYYY HH:mm");
      await gqlQuery(
        `mutation ($input: CreateCommentInput!) { createComment(input: $input) { id } }`,
        { input: { taskId: id, body: `${dateStr}              ${commentText.trim()}` } }
      );
      message.success("Комментарий добавлен");
      setCommentText("");
      setCommentDate(dayjs());
      loadComments();
    } catch {
      message.error("Не удалось добавить комментарий");
    } finally {
      setSavingComment(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await gqlQuery(
        `mutation ($id: ID!) { deleteComment(id: $id) }`,
        { id: commentId }
      );
      message.success("Комментарий удалён");
      loadComments();
    } catch {
      message.error("Не удалось удалить комментарий");
    }
  }

  async function handleUpdateComment() {
    if (!editingComment || !editCommentBody.trim()) return;
    try {
      const dateStr = editCommentDate.format("DD.MM.YYYY HH:mm");
      await gqlQuery(
        `mutation ($input: UpdateCommentInput!) { updateComment(input: $input) { id } }`,
        { input: { id: editingComment.id, body: `${dateStr}              ${editCommentBody.trim()}` } }
      );
      message.success("Комментарий обновлён");
      setEditingComment(null);
      setEditCommentBody("");
      loadComments();
    } catch {
      message.error("Не удалось обновить комментарий");
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <Card title={id ? "Редактировать задачу" : "Создать задачу"}>
          <Form key={id || "create"} form={form} layout="vertical" onFinish={onFinish}
      onValuesChange={checkFormValid}
             initialValues={{ title: "", description: "", estimatedHours: null, type: "software", progress: 0, priority: 1 }}>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="projectId" label="Проект" rules={[{ required: true, message: "Выберите проект" }]}>
                  <Select
                    placeholder="Выберите проект"
                    options={projects.map((p) => ({ label: `${p.code ? `[${p.code}] ` : ""}${p.name}`, value: p.id }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="statusId" label="Статус" rules={[{ required: true, message: "Выберите статус" }]}>
                  <Select
                    placeholder="Выберите статус"
                    options={statuses.map((s) => ({ label: statusLabel(s.code, s.name), value: s.id }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="type" label="Тип задачи">
                  <Select
                    options={[
                      { label: "ПО", value: "software" },
                      { label: "Производство", value: "hardware" },
                      { label: "Исследование", value: "research" },
                      { label: "Ошибка", value: "bug" },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="priority" label="Приоритет">
                  <Select
                    options={[
                      { label: "Низкий", value: 0 },
                      { label: "Средний", value: 1 },
                      { label: "Высокий", value: 2 },
                      { label: "Критический", value: 3 },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="assigneeIds" label="Исполнители">
                  <Select mode="multiple" allowClear placeholder="Выберите исполнителей" options={users.map((user) => ({ label: user.firstName, value: user.id }))} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="progress" label="Прогресс">
                  <Select options={[0, 25, 50, 75, 100].map((value) => ({ label: `${value}%`, value }))} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="title" label="Название" rules={[{ required: true }]}>
              <Input />
            </Form.Item>

            <Form.Item name="description" label="Описание">
              <Input.TextArea rows={3} />
            </Form.Item>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="plannedStart" label="План старт">
                  <DatePicker showTime={{ format: 'HH:mm' }} format="DD.MM.YYYY HH:mm" style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="plannedEnd" label="План конец">
                  <DatePicker showTime={{ format: 'HH:mm' }} format="DD.MM.YYYY HH:mm" style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="estimatedHours" label="Оценка (часы)">
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={saving} disabled={!id && !formValid}>Сохранить</Button>
            </Form.Item>
        </Form>
      </Card>

      {id && (
        <Card title="Комментарии" style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <DatePicker
              showTime={{ format: "HH:mm" }}
              format="DD.MM.YYYY HH:mm"
              value={commentDate}
              onChange={(v) => setCommentDate(v ?? dayjs())}
              style={{ width: 200, flexShrink: 0 }}
            />
            <Input.TextArea
              rows={2}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Добавьте комментарий..."
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              loading={savingComment}
              onClick={handleSaveComment}
              disabled={!commentText.trim()}
              style={{ flexShrink: 0 }}
            >
              Добавить
            </Button>
          </div>
          <List
            dataSource={comments}
            locale={{ emptyText: "Нет комментариев" }}
            renderItem={(c) => (
              <List.Item
                style={{ padding: "8px 0" }}
                actions={[
                  <Button
                    key="edit"
                    size="small"
                    onClick={() => {
                      const match = c.body.match(/^(\d{2}\.\d{2}\.\d{4} \d{2}:\d{2})\s+(.+)$/s);
                      setEditingComment(c);
                      if (match) {
                        const d = dayjs(match[1], "DD.MM.YYYY HH:mm");
                        setEditCommentDate(d.isValid() ? d : dayjs());
                        setEditCommentBody(match[2]);
                      } else {
                        setEditCommentDate(dayjs());
                        setEditCommentBody(c.body);
                      }
                    }}
                  >
                    Править
                  </Button>,
                  <Popconfirm
                    key="delete"
                    title="Удалить комментарий?"
                    okText="Удалить"
                    cancelText="Отмена"
                    onConfirm={() => handleDeleteComment(c.id)}
                  >
                    <Button size="small" danger>Удалить</Button>
                  </Popconfirm>,
                ]}
              >
                <div style={{ width: "100%" }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 2 }}>
                    №{c.number} {dayjs(c.createdAt).format("DD.MM.YYYY HH:mm")} • {c.authorName}
                  </Typography.Text>
                  <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
                </div>
              </List.Item>
            )}
          />
          <Modal
            title="Редактировать комментарий"
            open={!!editingComment}
            onOk={handleUpdateComment}
            onCancel={() => {
              setEditingComment(null);
              setEditCommentBody("");
            }}
            okText="Сохранить"
            cancelText="Отмена"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <Typography.Text strong>Дата</Typography.Text>
                <DatePicker
                  showTime={{ format: "HH:mm" }}
                  format="DD.MM.YYYY HH:mm"
                  value={editCommentDate}
                  onChange={(v) => setEditCommentDate(v ?? dayjs())}
                  style={{ width: "100%", marginTop: 4 }}
                />
              </div>
              <div>
                <Typography.Text strong>Текст</Typography.Text>
                <Input.TextArea
                  rows={4}
                  value={editCommentBody}
                  onChange={(e) => setEditCommentBody(e.target.value)}
                  style={{ marginTop: 4 }}
                />
              </div>
            </div>
          </Modal>
        </Card>
      )}
    </div>
  );
}
