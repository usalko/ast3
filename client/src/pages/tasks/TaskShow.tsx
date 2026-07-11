import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, Descriptions, Button, Modal, message, Tag, Input, List, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { gqlQuery } from "@/api/graphql";
import { riskLabel } from "@/utils/riskLabels";
import { statusLabel } from "@/utils/statusLabels";
import dayjs from "dayjs";

type Task = { id: string; title: string; description?: string; plannedStart?: string | null; plannedEnd?: string | null; progress?: number | null; estimatedHours?: number | null; type?: string; priority?: number; comment?: string; status?: { id: string; name: string; code?: string } | null; assignees?: { firstName?: string | null }[] | null };

type TaskComment = {
  id: string;
  authorName: string;
  body: string;
  number: number;
  createdAt: string;
};

export function TaskShow() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [newComment, setNewComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const navigate = useNavigate();

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

  useEffect(() => {
    if (!id) return;
    gqlQuery<{ task: Task }>(`query ($id: ID!) { task(id: $id) { id title description plannedStart plannedEnd progress estimatedHours type priority comment status { id name code } assignees { firstName } } }`, { id })
      .then((res) => {
        setTask(res.task ?? null);
      });
    loadComments();
  }, [id]);

  if (!task) return <div style={{ padding: 16 }}>Загрузка...</div>;

  async function handleSaveComment() {
    if (!id || !newComment.trim()) return;
    setSavingComment(true);
    try {
      await gqlQuery(
        `mutation ($input: CreateCommentInput!) { createComment(input: $input) { id authorName body number createdAt } }`,
        { input: { taskId: id, body: newComment } }
      );
      message.success("Комментарий добавлен");
      setNewComment("");
      loadComments();
    } catch (err) {
      message.error("Не удалось добавить комментарий");
    } finally {
      setSavingComment(false);
    }
  }

  async function handleDelete() {
    Modal.confirm({
      title: "Удалить задачу?",
      content: "Вы уверены? Это действие необратимо.",
      okText: "Удалить",
      okType: "danger",
      cancelText: "Отмена",
      onOk: async () => {
        try {
          await gqlQuery(`mutation ($id: ID!) { deleteTask(id: $id) }`, { id });
          message.success("Задача удалена");
          navigate(-1);
        } catch (err) {
          message.error("Не удалось удалить задачу (возможно, мутация отсутствует на сервере)");
        }
      },
    });
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <Button type="primary" style={{ marginRight: 8 }} onClick={() => navigate(`/tasks/${task.id}/edit`)}>Редактировать</Button>
        <Button danger onClick={handleDelete}>Удалить</Button>
      </div>

      <Card title={task.title}>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Статус">{statusLabel(task.status?.code, task.status?.name)}</Descriptions.Item>
          <Descriptions.Item label="Тип">{taskTypeLabel(task.type)}</Descriptions.Item>
          <Descriptions.Item label="Исполнитель">{(task.assignees ?? []).map((a) => a.firstName).join(", ") || "—"}</Descriptions.Item>
          <Descriptions.Item label="Описание">{task.description}</Descriptions.Item>
          <Descriptions.Item label="План">{task.plannedStart ?? ""} — {task.plannedEnd ?? ""}</Descriptions.Item>
          <Descriptions.Item label="Прогресс">{task.progress ?? 0}%</Descriptions.Item>
          <Descriptions.Item label="Приоритет"><Tag color={task.priority !== undefined && task.priority !== null && task.priority >= 2 ? "error" : task.priority === 1 ? "warning" : "default"}>{task.plannedEnd && new Date(task.plannedEnd) < new Date() && (!task.status?.code || task.status.code !== "done") ? "Просрочено" : riskLabel(task.priority)}</Tag></Descriptions.Item>
          <Descriptions.Item label="Оценка">{task.estimatedHours ?? "—"} ч</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Комментарии" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Input.TextArea
            rows={3}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Добавьте комментарий..."
          />
          <Button
            type="primary"
            style={{ marginTop: 8 }}
            loading={savingComment}
            onClick={handleSaveComment}
            disabled={!newComment.trim()}
          >
            Добавить комментарий
          </Button>
        </div>
        <List
          dataSource={comments}
          locale={{ emptyText: "Нет комментариев" }}
          renderItem={(c) => (
            <List.Item style={{ padding: "12px 0" }}>
              <div style={{ width: "100%" }}>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                  {dayjs(c.createdAt).format("DD.MM.YYYY HH:mm")} — {c.number} • {c.authorName}
                </Typography.Text>
                <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
              </div>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
}

function taskTypeLabel(value?: string) {
  if (value === "hardware") return "Производство";
  if (value === "research") return "Исследование";
  if (value === "bug") return "Ошибка";
  return "ПО";
}
