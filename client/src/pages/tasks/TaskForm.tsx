import { useEffect, useState } from "react";
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
  assigneeId?: string;
  type?: string;
  progress?: number;
};
type TaskFormValues = Omit<Task, "plannedStart" | "plannedEnd"> & {
  plannedStart?: Dayjs | null;
  plannedEnd?: Dayjs | null;
};
type User = { id: string; fullName: string };
type TaskStatus = { id: string; name: string; code: string };
type ProjectOption = { id: string; code?: string; name: string };

export function TaskForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    gqlQuery<{ projects: ProjectOption[] }>(`query { projects { id code name } }`)
      .then((res) => setProjects(res.projects ?? []))
      .catch(() => setProjects([]));
    gqlQuery<{ users: User[] }>(`query { users { id fullName } }`)
      .then((res) => setUsers(res.users ?? []))
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    if (!id) return;
    gqlQuery<{ task: Task }>(`query ($id: ID!) { task(id: $id) { id title description plannedStart plannedEnd estimatedHours projectId statusId assigneeId type progress } }`, { id }).then((res) => {
      const t = res.task;
      form.setFieldsValue({
        ...t,
        plannedStart: t?.plannedStart ? dayjs(t.plannedStart) : undefined,
        plannedEnd: t?.plannedEnd ? dayjs(t.plannedEnd) : undefined,
      });
      if (t?.projectId) {
        void handleProjectChange(t.projectId);
      }
    });
  }, [id, form]);

  async function onFinish(values: TaskFormValues) {
    try {
      const input: Record<string, unknown> = {
        title: values.title,
        description: values.description || "",
        plannedStart: values.plannedStart ? values.plannedStart.toISOString() : null,
        plannedEnd: values.plannedEnd ? values.plannedEnd.toISOString() : null,
        estimatedHours: values.estimatedHours ?? null,
        statusId: form.getFieldValue("statusId"),
        assigneeId: form.getFieldValue("assigneeId"),
        type: form.getFieldValue("type"),
      };

      if (id) {
        input.progress = form.getFieldValue("progress");
      }

      if (id) {
        await gqlQuery(`mutation ($id: ID!, $input: UpdateTaskInput!) { updateTask(id: $id, input: $input) { id } }`, { id, input });
        message.success("Задача обновлена");
      } else {
        const createInput = { ...input, projectId: values.projectId };
        await gqlQuery(`mutation ($input: CreateTaskInput!) { createTask(input: $input) { id } }`, { input: createInput });
        message.success("Задача создана");
      }
      navigate(-1);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Ошибка при сохранении задачи${detail ? `: ${detail}` : ""}`);
    }
  }

  const handleProjectChange = async (projectId: string) => {
    if (!projectId) {
      setStatuses([]);
      return;
    }
    try {
      const res = await gqlQuery<{ project: { statuses: TaskStatus[] } }>(
        `query ($id: ID!) { project(id: $id) { statuses { id name code } } }`,
        { id: projectId }
      );
      setStatuses(res.project?.statuses ?? []);
    } catch {
      message.error("Не удалось загрузить статусы проекта");
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <Card title={id ? "Редактировать задачу" : "Создать задачу"}>
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ title: "", description: "", estimatedHours: null, type: "software", progress: 0 }}>
          {!id && (
            <Form.Item name="projectId" label="Проект" rules={[{ required: true, message: "Выберите проект" }]}>
              <Select
                placeholder="Выберите проект"
                onChange={(value) => handleProjectChange(value as string)}
                options={projects.map((p) => ({ label: `${p.code ? `[${p.code}] ` : ""}${p.name}`, value: p.id }))}
              />
            </Form.Item>
          )}
          <Form.Item name="statusId" label="Статус" rules={[{ required: true, message: "Выберите статус" }]}>
            <Select placeholder="Выберите статус" options={statuses.map((s) => ({ label: statusLabel(s.code, s.name), value: s.id }))} />
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
          <Form.Item name="assigneeId" label="Исполнитель">
            <Select allowClear placeholder="Выберите исполнителя" options={users.map((user) => ({ label: user.fullName, value: user.id }))} />
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
            <DatePicker showTime />
          </Form.Item>
          <Form.Item name="plannedEnd" label="План конец">
            <DatePicker showTime />
          </Form.Item>
          <Form.Item name="estimatedHours" label="Оценка (часы)">
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">Сохранить</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
