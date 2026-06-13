import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, Descriptions, List, Button, Modal, Form, Input, DatePicker, message, Select, Tag, Progress, Popconfirm } from "antd";
import { gqlQuery } from "@/api/graphql";
import { riskColor, riskLabel } from "@/utils/riskLabels";
import { statusLabel } from "@/utils/statusLabels";

type Task = {
  id: string;
  title: string;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  progress?: number | null;
  riskLevel?: number | null;
  isOverdue?: boolean | null;
  status?: { id: string; name: string; code?: string; color?: string | null } | null;
};
type Project = { id: string; code?: string; name: string; description?: string };

export function ProjectShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskModalVisible, setTaskModalVisible] = useState(false);

  function loadData(projectId: string) {
    gqlQuery<{ project: Project; tasks: Task[] }>(
      `query ($id: ID!) {
        project(id: $id) { id code name description }
        tasks(projectId: $id) { id title plannedStart plannedEnd progress riskLevel isOverdue status { id name code color } }
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

  if (!project) return <div style={{ padding: 16 }}>Загрузка...</div>;

  return (
    <div style={{ padding: 16 }}>
      <Card title={`${project.code ?? ""} — ${project.name}`}>
        <Descriptions bordered>
          <Descriptions.Item label="Описание" span={3}>{project.description}</Descriptions.Item>
        </Descriptions>
      </Card>

      <div style={{ marginTop: 12 }}>
        <Button type="primary" style={{ marginRight: 8 }} onClick={() => navigate(`/projects/${project.id}/edit`)}>Редактировать проект</Button>
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
        <Button onClick={() => setTaskModalVisible(true)}>Создать задачу</Button>
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
          <List.Item actions={[<Link key="open" to={`/tasks/${t.id}`}><Button>Открыть</Button></Link>]}>
            <List.Item.Meta
              title={
                <span>
                  {t.status?.name && <Tag color={t.status.color ?? "default"}>{statusLabel(t.status.code, t.status.name)}</Tag>}
                  <Tag color={riskColor(t.riskLevel)}>{t.isOverdue ? "Просрочено" : riskLabel(t.riskLevel)}</Tag>
                  <Link to={`/tasks/${t.id}`}>{t.title}</Link>
                </span>
              }
              description={`${t.plannedStart ?? "—"} → ${t.plannedEnd ?? "—"}`}
            />
            <Progress percent={t.progress ?? 0} style={{ width: 160 }} size="small" />
          </List.Item>
        )}
      />
    </div>
  );
}

function TaskCreateForm({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [form] = Form.useForm();
  const [statuses, setStatuses] = React.useState<Array<{ id: string; name: string; code?: string }>>([]);

  React.useEffect(() => {
    gqlQuery<{ project: { statuses: Array<{ id: string; name: string; code?: string }> } }>(
      `query ($id: ID!) { project(id: $id) { statuses { id name code } } }`,
      { id: projectId }
    ).then((res) => setStatuses(res.project?.statuses ?? []));
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
        <DatePicker showTime />
      </Form.Item>
      <Form.Item name="plannedEnd" label="План конец">
        <DatePicker showTime />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">Создать</Button>
      </Form.Item>
    </Form>
  );
}
