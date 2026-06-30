import { useEffect, useState } from "react";
import { Card, Button, Modal, Input, Select, Typography, Tag, Space, Empty, Spin, message, theme, Popconfirm } from "antd";
import { DeleteOutlined, PlusOutlined, RightCircleOutlined } from "@ant-design/icons";
import { gqlQuery } from "@/api/graphql";

type Project = { id: string; code?: string; name: string };
type TaskStatus = { id: string; name: string; code: string };
type BacklogTask = {
  id: string;
  code?: string;
  title: string;
  project: { id: string; code?: string; name: string };
  createdAt?: string;
};

const { Text, Title } = Typography;

export function BacklogPage() {
  const { token } = theme.useToken();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<BacklogTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskProjectId, setNewTaskProjectId] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    gqlQuery<{ projects: Project[] }>("query { projects { id code name } }")
      .then((res) => setProjects(res.projects ?? []))
      .catch(() => message.error("Не удалось загрузить проекты"));
  }, []);

  useEffect(() => {
    loadBacklog();
  }, []);

  async function loadBacklog() {
    setLoading(true);
    try {
      const res = await gqlQuery<{ backlogTasks: BacklogTask[] }>(
        `query {
          backlogTasks {
            id code title project { id code name } createdAt
          }
        }`
      );
      setTasks(res.backlogTasks ?? []);
    } catch {
      message.error("Не удалось загрузить бэклог");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTask() {
    if (!newTaskTitle.trim() || !newTaskProjectId) return;
    setCreating(true);
    try {
      const res = await gqlQuery<{ project: { statuses: TaskStatus[] } }>(
        `query ($projectId: ID!) {
          project(id: $projectId) { statuses { id code } }
        }`,
        { projectId: newTaskProjectId }
      );
      const backlogStatus = res.project?.statuses?.find((s) => s.code === "backlog");
      if (!backlogStatus) {
        message.error("У проекта нет статуса 'Бэклог'");
        return;
      }
      await gqlQuery(
        `mutation ($input: CreateTaskInput!) {
          createTask(input: $input) { id }
        }`,
        {
          input: {
            projectId: newTaskProjectId,
            title: newTaskTitle.trim(),
            statusId: backlogStatus.id,
          },
        }
      );
      message.success("Задача добавлена в бэклог");
      setModalOpen(false);
      setNewTaskTitle("");
      setNewTaskProjectId("");
      loadBacklog();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось создать задачу${detail ? `: ${detail}` : ""}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleMoveToDo(task: BacklogTask) {
    try {
      const res = await gqlQuery<{ project: { statuses: TaskStatus[] } }>(
        `query ($projectId: ID!) {
          project(id: $projectId) { statuses { id code } }
        }`,
        { projectId: task.project.id }
      );
      const todoStatus = res.project?.statuses?.find((s) => s.code === "todo");
      if (!todoStatus) {
        message.error("У проекта нет статуса 'К выполнению'");
        return;
      }
      await gqlQuery(
        `mutation ($taskId: ID!, $statusId: ID!, $boardOrder: Float!) {
          moveTask(taskId: $taskId, statusId: $statusId, boardOrder: $boardOrder) {
            id status { id name code }
          }
        }`,
        { taskId: task.id, statusId: todoStatus.id, boardOrder: 0 }
      );
      message.success("Задача перемещена на канбан-доску");
      loadBacklog();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось переместить задачу${detail ? `: ${detail}` : ""}`);
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

  return (
    <div style={{ padding: 16, background: token.colorBgLayout, minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Бэклог - отложенные задачи</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Добавить задачу
        </Button>
      </div>

      <Spin spinning={loading}>
        {tasks.length === 0 && !loading ? (
          <Empty description="Нет отложенных задач" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tasks.map((task) => (
              <Card
                key={task.id}
                size="small"
                hoverable
                styles={{ body: { padding: "12px 16px" } }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, marginRight: 16 }}>
                    <Space>
                      <Text strong>{task.title}</Text>
                    </Space>
                  </div>
                  <Space>
                    <Tag color="default">{task.project.code ? `[${task.project.code}] ${task.project.name}` : task.project.name}</Tag>
                    <Button
                      type="primary"
                      size="small"
                      icon={<RightCircleOutlined />}
                      onClick={() => handleMoveToDo(task)}
                    >
                      Добавить к выполнению
                    </Button>
                    <Popconfirm title="Удалить задачу?" okText="Удалить" cancelText="Отмена" onConfirm={() => handleDeleteTask(task.id)}>
                      <Button danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Spin>

      <Modal
        title="Добавить задачу в бэклог"
        open={modalOpen}
        onOk={handleCreateTask}
        onCancel={() => {
          setModalOpen(false);
          setNewTaskTitle("");
          setNewTaskProjectId("");
        }}
        confirmLoading={creating}
        okText="Создать"
        cancelText="Отмена"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <Text strong>Текст задачи</Text>
            <Input.TextArea
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Введите описание задачи"
              rows={3}
              style={{ marginTop: 4 }}
            />
          </div>
          <div>
            <Text strong>Проект</Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              value={newTaskProjectId || undefined}
              onChange={(value) => setNewTaskProjectId(value as string)}
              placeholder="Выберите проект"
              options={projects.map((p) => ({
                label: `${p.code ? `[${p.code}] ` : ""}${p.name}`,
                value: p.id,
              }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
