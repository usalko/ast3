import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, Descriptions, Button, Modal, message } from "antd";
import { useNavigate } from "react-router-dom";
import { gqlQuery } from "@/api/graphql";

type Task = { id: string; title: string; description?: string; plannedStart?: string | null; plannedEnd?: string | null; progress?: number | null; estimatedHours?: number | null; type?: string; status?: { id: string; name: string } | null; assignee?: { fullName?: string | null } | null };

export function TaskShow() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    gqlQuery<{ task: Task }>(`query ($id: ID!) { task(id: $id) { id title description plannedStart plannedEnd progress estimatedHours type status { id name } assignee { fullName } } }`, { id })
      .then((res) => setTask(res.task ?? null));
  }, [id]);

  if (!task) return <div style={{ padding: 16 }}>Загрузка...</div>;

  async function handleDelete() {
    Modal.confirm({
      title: "Удалить задачу?",
      content: "Вы уверены? Это действие необратимо.",
      okText: "Удалить",
      okType: "danger",
      cancelText: "Отмена",
      onOk: async () => {
        try {
          await gqlQuery(`mutation ($id: ID!) { deleteTask(id: $id) { success } }`, { id });
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
        <Button style={{ marginRight: 8 }} onClick={() => navigate("/time-tracking")}>Учёт времени</Button>
        <Button danger onClick={handleDelete}>Удалить</Button>
      </div>

      <Card title={task.title}>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Статус">{task.status?.name ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Тип">{taskTypeLabel(task.type)}</Descriptions.Item>
          <Descriptions.Item label="Исполнитель">{task.assignee?.fullName ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Описание">{task.description}</Descriptions.Item>
          <Descriptions.Item label="План">{task.plannedStart ?? ""} — {task.plannedEnd ?? ""}</Descriptions.Item>
          <Descriptions.Item label="Прогресс">{task.progress ?? 0}%</Descriptions.Item>
          <Descriptions.Item label="Оценка">{task.estimatedHours ?? "—"} ч</Descriptions.Item>
        </Descriptions>
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
