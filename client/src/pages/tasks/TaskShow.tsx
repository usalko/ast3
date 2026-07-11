import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, Descriptions, Button, Modal, message, Tag, Input, List, Typography, DatePicker, Space } from "antd";
import { useNavigate } from "react-router-dom";
import { gqlQuery } from "@/api/graphql";
import { riskLabel } from "@/utils/riskLabels";
import { statusLabel } from "@/utils/statusLabels";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

type Task = { id: string; title: string; code?: string; description?: string; plannedStart?: string | null; plannedEnd?: string | null; progress?: number | null; estimatedHours?: number | null; type?: string; priority?: number; comment?: string; status?: { id: string; name: string; code?: string } | null; assignees?: { firstName?: string | null }[] | null };

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
  const [commentDate, setCommentDate] = useState<Dayjs>(dayjs());
  const [commentText, setCommentText] = useState("");
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
    gqlQuery<{ task: Task }>(`query ($id: ID!) { task(id: $id) { id code title description plannedStart plannedEnd progress estimatedHours type priority comment status { id name code } assignees { firstName } } }`, { id })
      .then((res) => {
        setTask(res.task ?? null);
      });
    loadComments();
  }, [id]);

  if (!task) return <div style={{ padding: 16 }}>Загрузка...</div>;

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
          message.error("Не удалось удалить задачу");
        }
      },
    });
  }

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => navigate(`/tasks/${task.id}/edit`)}>Редактировать</Button>
        <Button danger onClick={handleDelete}>Удалить</Button>
        {task.code && <Tag color="blue">{task.code}</Tag>}
      </Space>

      <Card title={task.title}>
        <Descriptions column={3} bordered size="small">
          <Descriptions.Item label="Статус">{statusLabel(task.status?.code, task.status?.name)}</Descriptions.Item>
          <Descriptions.Item label="Тип">{taskTypeLabel(task.type)}</Descriptions.Item>
          <Descriptions.Item label="Исполнитель">{(task.assignees ?? []).map((a) => a.firstName).join(", ") || "—"}</Descriptions.Item>
          <Descriptions.Item label="Прогресс">{task.progress ?? 0}%</Descriptions.Item>
          <Descriptions.Item label="Приоритет"><Tag color={task.priority !== undefined && task.priority !== null && task.priority >= 2 ? "error" : task.priority === 1 ? "warning" : "default"}>{riskLabel(task.priority)}</Tag></Descriptions.Item>
          <Descriptions.Item label="Оценка">{task.estimatedHours ?? "—"} ч</Descriptions.Item>
          <Descriptions.Item label="План" span={2}>{task.plannedStart ? dayjs(task.plannedStart).format("DD.MM.YYYY HH:mm") : "—"} — {task.plannedEnd ? dayjs(task.plannedEnd).format("DD.MM.YYYY HH:mm") : "—"}</Descriptions.Item>
          <Descriptions.Item label="Описание" span={3}>{task.description || "—"}</Descriptions.Item>
          {task.comment ? <Descriptions.Item label="Заметка" span={3}>{task.comment}</Descriptions.Item> : null}
        </Descriptions>
      </Card>

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
            <List.Item style={{ padding: "8px 0" }}>
              <div style={{ width: "100%" }}>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 2 }}>
                  №{c.number} {dayjs(c.createdAt).format("DD.MM.YYYY HH:mm")} • {c.authorName}
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
