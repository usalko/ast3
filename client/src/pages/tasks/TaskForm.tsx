import { useEffect, useRef, useState } from "react";
import { Form, Input, Button, DatePicker, InputNumber, Card, message, Select } from "antd";
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
  assigneeIds?: string[];
};
type TaskFormValues = Omit<Task, "plannedStart" | "plannedEnd"> & {
  plannedStart?: Dayjs | null;
  plannedEnd?: Dayjs | null;
};
type User = { id: string; firstName: string };
type TaskStatus = { id: string; name: string; code: string };
type ProjectOption = { id: string; code?: string; name: string };

export function TaskForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const existingIdsRef = useRef<string[]>([]);

  const loadStatuses = async (projectId: string) => {
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
  };

  const projectId = Form.useWatch("projectId", form);

  useEffect(() => {
    if (projectId) {
      loadStatuses(projectId);
    }
  }, [projectId]);

  useEffect(() => {
    if (!id) return;
    gqlQuery<{ task: Task & { assigneeIds?: string[] } }>(`query ($id: ID!) { task(id: $id) { id title description plannedStart plannedEnd estimatedHours projectId statusId assigneeIds type progress priority } }`, { id }).then(async (res) => {
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
  }, [id, form]);

  useEffect(() => {
    // always load projects
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
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Ошибка при сохранении задачи${detail ? `: ${detail}` : ""}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <Card title={id ? "Редактировать задачу" : "Создать задачу"}>
         <Form key={id || "create"} form={form} layout="vertical" onFinish={onFinish} initialValues={{ title: "", description: "", estimatedHours: null, type: "software", progress: 0, priority: 1, assigneeIds: undefined }}>

            <Form.Item name="projectId" label="Проект" rules={[{ required: true, message: "Выберите проект" }]}>
              <Select
                placeholder="Выберите проект"
                options={projects.map((p) => ({ label: `${p.code ? `[${p.code}] ` : ""}${p.name}`, value: p.id }))}
              />
            </Form.Item>
          <Form.Item name="statusId" label="Статус" rules={[{ required: true, message: "Выберите статус" }]}>
            <Select
              placeholder="Выберите статус"
              options={statuses.map((s) => ({ label: statusLabel(s.code, s.name), value: s.id }))}
            />
          </Form.Item>
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
          <Form.Item name="assigneeIds" label="Исполнители">
              <Select mode="multiple" allowClear placeholder="Выберите исполнителей" options={users.map((user) => ({ label: user.firstName, value: user.id }))} />
          </Form.Item>
          <Form.Item name="progress" label="Прогресс">
            <Select options={[0, 25, 50, 75, 100].map((value) => ({ label: `${value}%`, value }))} />
          </Form.Item>
          <Form.Item name="title" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="plannedStart" label="План старт">
            <DatePicker showTime={{ format: 'HH:mm' }} format="DD.MM.YYYY HH:mm" />
          </Form.Item>
          <Form.Item name="plannedEnd" label="План конец">
            <DatePicker showTime={{ format: 'HH:mm' }} format="DD.MM.YYYY HH:mm" />
          </Form.Item>
          <Form.Item name="estimatedHours" label="Оценка (часы)">
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>Сохранить</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

