import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, Descriptions, List, Button, Modal, Form, Input, DatePicker, message, Select, Tag, Progress, Popconfirm, Switch, Space } from "antd";
import { gqlQuery } from "@/api/graphql";
import { riskColor, riskLabel } from "@/utils/riskLabels";
import { statusLabel } from "@/utils/statusLabels";

type Task = {
  id: string;
  title: string;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  progress?: number | null;
  priority?: number;
  isOverdue?: boolean | null;
  status?: { id: string; name: string; code?: string; color?: string | null } | null;
};
type Project = { id: string; code?: string; name: string; description?: string; status?: string };

export function ProjectShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskModalVisible, setTaskModalVisible] = useState(false);

  function loadData(projectId: string) {
    gqlQuery<{ project: Project; tasks: Task[] }>(
      `query ($id: ID!) {
        project(id: $id) { id code name description status }
        tasks(projectId: $id) { id title plannedStart plannedEnd progress priority isOverdue status { id name code color } }
      }`,
      { id: projectId }
    ).then((res) => {
      setProject(res.project ?? null);
      setTasks(res.tasks ?? []);
    });
  }

  useEffect(() => {
    if (!id) return;
    loadData(id);
  }, [id]);

  async function handleDeleteProject() {
    if (!id) return;
    try {
      await gqlQuery(
        `mutation ($id: ID!) { deleteProject(id: $id) { success } }`,
        { id }
      );
      message.success("Проект удалён");
      navigate("/projects");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось удалить проект${detail ? `: ${detail}` : ""}`);
    }
  }

  async function handleDeleteTask(taskId: string) {
    try {
      await gqlQuery(
        `mutation ($id: ID!) { deleteTask(id: $id) }`,
        { id: taskId }
      );
      setTasks((current) => current.filter((t) => t.id !== taskId));
      message.success("Задача удалена");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось удалить задачу${detail ? `: ${detail}` : ""}`);
    }
  }

  async function handleToggleStatus(checked: boolean) {
    if (!id || !project) return;
    try {
      await gqlQuery(
        `mutation ($id: ID!, $input: UpdateProjectInput!) {
          updateProject(id: $id, input: $input) { id status }
        }`,
        { id, input: { status: checked ? "active" : "on_hold" } }
      );
      setProject({ ...project, status: checked ? "active" : "on_hold" });
      message.success(`Проект ${checked ? "активирован" : "деактивирован"}`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось изменить статус${detail ? `: ${detail}` : ""}`);
    }
  }

  if (!project) return <div style={{ padding: 16 }}>Загрузка...</div>;

  return (
    <div style={{ padding: 16 }}>
      <Card title={`${project.code ?? ""} — ${project.name}`}>
        <Descriptions bordered>
          <Descriptions.Item label="Описание" span={3}>{project.description}</Descriptions.Item>
          <Descriptions.Item label="Статус">
            <Switch checked={project.status !== "on_hold" && project.status !== "cancelled"} onChange={handleToggleStatus} />
            <Tag style={{ marginLeft: 8 }}>
              {project.status === "active" ? "Активен" : "Неактивен"}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <div style={{ marginTop: 12 }}>
        <Button style={{ marginRight: 8 }} onClick={() => navigate(`/projects/${project.id}/edit`)}>Редактировать проект</Button>
        <Button style={{ marginRight: 8 }} onClick={() => navigate(`/kanban?projectId=${project.id}`)}>Канбан</Button>
        <Button style={{ marginRight: 8 }} onClick={() => navigate(`/projects/${project.id}/gantt`)}>Gantt</Button>
        <Popconfirm
          title="Удалить проект?"
          description="Все задачи проекта будут переведены в статус «Отменено»."
          okText="Удалить"
          cancelText="Отмена"
          onConfirm={handleDeleteProject}
        >
          <Button danger>Удалить проект</Button>
        </Popconfirm>
        <Button type="primary" onClick={() => setTaskModalVisible(true)}>Создать задачу</Button>
      </div>

      {/* task create modal */}
      <Modal title="Создать задачу" open={taskModalVisible} onCancel={() => setTaskModalVisible(false)} footer={null} destroyOnClose>
        <TaskCreateForm projectId={project.id} onCreated={() => { setTaskModalVisible(false); loadData(project.id); }} />
      </Modal>

      <List
        style={{ marginTop: 16 }}
        header={<div>Задачи ({tasks.length})</div>}
        bordered
        dataSource={tasks}
        locale={{ emptyText: "Пока нет задач" }}
        renderItem={(t) => (
          <List.Item actions={[
            <Link key="open" to={`/tasks/${t.id}`}><Button>Открыть</Button></Link>,
            <Popconfirm key="delete" title="Удалить задачу?" okText="Удалить" cancelText="Отмена" onConfirm={() => handleDeleteTask(t.id)}>
              <Button danger size="small">Удалить</Button>
            </Popconfirm>,
          ]} style={{ paddingTop: 6, paddingBottom: 6 }}>
            <List.Item.Meta
              title={
                <span style={{ fontSize: 18 }}>
                  {t.status?.name && <Tag color={t.status.color ?? "default"} style={{ fontSize: 14, padding: "2px 10px" }}>{statusLabel(t.status.code, t.status.name)}</Tag>}
                  <Tag color={riskColor(t.priority)} style={{ fontSize: 14, padding: "2px 10px" }}>{t.isOverdue ? "Просрочено" : riskLabel(t.priority)}</Tag>
                  <Link to={`/tasks/${t.id}`} style={{ fontSize: 18, color: "#000" }}>{t.title}</Link>
                </span>
              }
              description={<span style={{ fontSize: 15 }}>{`${t.plannedStart ? formatDateNoSeconds(t.plannedStart) : "—"} → ${t.plannedEnd ? formatDateNoSeconds(t.plannedEnd) : "—"}`}</span>}
            />
            <Progress percent={t.progress ?? 0} style={{ width: 160 }} size="small" />
          </List.Item>
        )}
      />
    </div>
  );
}

function formatDateNoSeconds(value: string) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return value;
  }
}

function TaskCreateForm({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [form] = Form.useForm();
  const [statuses, setStatuses] = React.useState<Array<{ id: string; name: string; code?: string }>>([]);

  React.useEffect(() => {
    gqlQuery<{ project: { statuses: Array<{ id: string; name: string; code?: string }> } }>(
      `query ($id: ID!) { project(id: $id) { statuses { id name code } } }`,
      { id: projectId }
    ).then((res) => setStatuses((res.project?.statuses ?? []).filter((s) => s.code !== "backlog")));
  }, [projectId]);

  async function onFinish(values: Record<string, unknown>) {
    try {
      const input: Record<string, unknown> = {
        projectId,
        title: values.title,
        description: (values.description as string) || "",
        plannedStart: values.plannedStart ? (values.plannedStart as unknown as { toISOString: () => string }).toISOString() : null,
        plannedEnd: values.plannedEnd ? (values.plannedEnd as unknown as { toISOString: () => string }).toISOString() : null,
        statusId: values.statusId,
        type: values.type || "hardware",
      };
      await gqlQuery(`mutation ($input: CreateTaskInput!) { createTask(input: $input) { id } }`, { input });
      message.success("Задача создана");
      form.resetFields();
      onCreated();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Ошибка при создании задачи${detail ? `: ${detail}` : ""}`);
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item name="statusId" label="Статус" rules={[{ required: true }]}>
        <Select placeholder="Выберите статус" options={statuses.map((s) => ({ label: statusLabel(s.code, s.name), value: s.id }))} />
      </Form.Item>
      <Form.Item name="title" label="Название" rules={[{ required: true }]}>
        <Input />
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
      <Form.Item name="description" label="Описание">
        <Input.TextArea rows={3} />
      </Form.Item>
      <Form.Item name="plannedStart" label="План старт">
        <DatePicker showTime={{ format: 'HH:mm' }} format="DD.MM.YYYY HH:mm" />
      </Form.Item>
      <Form.Item name="plannedEnd" label="План конец">
        <DatePicker showTime={{ format: 'HH:mm' }} format="DD.MM.YYYY HH:mm" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">Создать</Button>
      </Form.Item>
    </Form>
  );
}
