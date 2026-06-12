import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Card, Select, Tag, Space, Typography, Empty, Progress, Button, message, Spin } from "antd";
import { Link } from "react-router-dom";
import { gqlQuery } from "@/api/graphql";

type Project = { id: string; code?: string; name: string };
type TaskStatus = { id: string; name: string; code: string; color?: string | null; isDone?: boolean };
type User = { id: string; fullName?: string | null };
type Task = {
  id: string;
  code?: string;
  title: string;
  progress?: number | null;
  status: TaskStatus;
  assignee?: User | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
};
type ProjectWithStatuses = { id: string; statuses: TaskStatus[] };

const { Text } = Typography;

export function KanbanPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const projectFromQuery = searchParams.get("projectId");
    if (projectFromQuery) {
      setProjectId(projectFromQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    gqlQuery<{ projects: Project[] }>("query { projects { id code name } }")
      .then((res) => {
        const projectList = res.projects ?? [];
        setProjects(projectList);
        setProjectId((current) => current || projectList[0]?.id || "");
      })
      .catch(() => message.error("Не удалось загрузить проекты"));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    gqlQuery<{ project: ProjectWithStatuses; tasks: Task[] }>(
      `query ($projectId: ID!) {
        project(id: $projectId) { id statuses { id name code color isDone } }
        tasks(projectId: $projectId) {
          id code title progress status { id name code color isDone }
          assignee { id fullName } plannedStart plannedEnd
        }
      }`,
      { projectId }
    )
      .then((res) => {
        setStatuses(res.project?.statuses ?? []);
        setTasks(res.tasks ?? []);
      })
      .catch(() => {
        setStatuses([]);
        setTasks([]);
        message.error("Не удалось загрузить канбан");
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const tasksByStatus = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    for (const status of statuses) {
      grouped.set(status.id, []);
    }
    for (const task of tasks) {
      const statusId = task.status?.id || "backlog";
      grouped.set(statusId, [...(grouped.get(statusId) ?? []), task]);
    }
    for (const [statusId, items] of grouped) {
      grouped.set(
        statusId,
        items.sort((a, b) => Number(a.plannedStart ?? "") > Number(b.plannedStart ?? "") ? 1 : -1)
      );
    }
    return grouped;
  }, [statuses, tasks]);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((task) => task.status?.isDone || task.status?.code === "done").length;
  const avgProgress = totalTasks === 0 ? 0 : Math.round(tasks.reduce((sum, task) => sum + (task.progress ?? 0), 0) / totalTasks);

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) {
      return;
    }
    const destination = result.destination;
    if (destination.droppableId === result.source.droppableId && destination.index === result.source.index) {
      return;
    }
    const status = statuses.find((item) => item.id === destination.droppableId);
    const task = tasks.find((item) => item.id === result.draggableId);
    if (!status || !task) return;

    try {
      await gqlQuery(
        `mutation ($taskId: ID!, $statusId: ID!, $boardOrder: Float!) {
          moveTask(taskId: $taskId, statusId: $statusId, boardOrder: $boardOrder) {
            id status { id name code }
          }
        }`,
        { taskId: task.id, statusId: status.id, boardOrder: destination.index }
      );
      setTasks((current) => {
        const next = current.filter((item) => item.id !== task.id);
        const moved = { ...task, status };
        next.splice(destination.index, 0, moved);
        return next;
      });
      message.success("Статус задачи обновлён");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось переместить задачу${detail ? `: ${detail}` : ""}`);
    }
  }

  async function handleProgressChange(taskId: string, progress: number) {
    try {
      await gqlQuery(
        `mutation ($id: ID!, $input: UpdateTaskInput!) {
          updateTask(id: $id, input: $input) { id progress }
        }`,
        { id: taskId, input: { progress } }
      );
      setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, progress } : task)));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось обновить прогресс${detail ? `: ${detail}` : ""}`);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 16 }} wrap>
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
        <Text type="secondary">Задач: {totalTasks}</Text>
        <Text type="secondary">Готово: {doneTasks}</Text>
        <Text type="secondary">Средний прогресс: {avgProgress}%</Text>
      </Space>

      {!projectId ? (
        <Empty description="Создайте проект, чтобы начать работу с канбаном" />
      ) : (
        <Spin spinning={loading}>
          <DragDropContext onDragEnd={handleDragEnd}>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
              {statuses.map((status) => (
                <Droppable droppableId={status.id} key={status.id}>
                  {(provided) => {
                    const columnTasks = tasksByStatus.get(status.id) ?? [];
                    return (
                      <Card
                        key={status.id}
                        size="small"
                        title={
                          <Space>
                            <Tag color={status.color ?? "default"}>{status.name}</Tag>
                            <Text type="secondary">{columnTasks.length}</Text>
                          </Space>
                        }
                        style={{ minWidth: 280, maxWidth: 340, backgroundColor: "#fafafa" }}
                        bodyStyle={{ minHeight: 260, padding: 8 }}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {columnTasks.map((task, index) => (
                          <Draggable draggableId={task.id} index={index} key={task.id}>
                            {(draggable) => (
                              <div
                                ref={draggable.innerRef}
                                {...draggable.draggableProps}
                                {...draggable.dragHandleProps}
                                style={{
                                  ...draggable.draggableProps.style,
                                  marginBottom: 8,
                                }}
                              >
                                <Card
                                  size="small"
                                  hoverable
                                  bodyStyle={{ padding: 12 }}
                                  title={
                                    <Space direction="vertical" size={4} style={{ width: "100%" }}>
                                      <Text strong>{task.title}</Text>
                                      <Text type="secondary" code>{task.code}</Text>
                                    </Space>
                                  }
                                  extra={<Link to={`/tasks/${task.id}`}><Button type="link">Открыть</Button></Link>}
                                >
                                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                                      <Text type="secondary">Исполнитель: {task.assignee?.fullName ?? "Без исполнителя"}</Text>

                                    <Progress percent={task.progress ?? 0} size="small" />
                                    <Select
                                      size="small"
                                      value={task.progress ?? 0}
                                      onChange={(value) => handleProgressChange(task.id, value as number)}
                                      options={[0, 25, 50, 75, 100].map((value) => ({ label: `${value}%`, value }))}
                                      style={{ width: "100%" }}
                                    />
                                  </Space>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </Card>
                    );
                  }}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
        </Spin>
      )}
    </div>
  );
}
