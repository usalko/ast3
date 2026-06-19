import { useEffect, useState } from "react";
import { Table, Button, Space, Typography, Tag, Popconfirm, message } from "antd";
import { Link } from "react-router-dom";
import { gqlQuery } from "@/api/graphql";
import { statusLabel } from "@/utils/statusLabels";
import { riskLabel } from "@/utils/riskLabels";

const { Text } = Typography;

type Task = {
  id: string;
  code?: string;
  title: string;
  type?: string;
  progress?: number | null;
  priority?: number;
  status: { name: string; code: string };
};

export function TaskList() {
  const [data, setData] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    gqlQuery<{ tasksAll: Task[] }>(
      `query { tasksAll { id code title type progress priority status { name code } } }`
    )
      .then((res) => setData(res.tasksAll ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(taskId: string) {
    try {
      await gqlQuery(
        `mutation ($id: ID!) { deleteTask(id: $id) }`,
        { id: taskId }
      );
      setData((current) => current.filter((t) => t.id !== taskId));
      message.success("Задача удалена");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось удалить задачу${detail ? `: ${detail}` : ""}`);
    }
  }

  function taskTypeLabel(value?: string) {
    if (value === "hardware") return "Производство";
    if (value === "research") return "Исследования";
    if (value === "bug") return "Ошибка";
    return "ПО";
  }

  const columns = [
    {
      title: "Код",
      dataIndex: "code",
      key: "code",
      render: (v?: string) => (v ? <Text code>{v}</Text> : "—"),
    },
    {
      title: "Название",
      dataIndex: "title",
      key: "title",
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: "Тип",
      dataIndex: "type",
      key: "type",
      render: (v?: string) => taskTypeLabel(v),
    },
    {
      title: "Статус",
      key: "status",
      render: (_: unknown, record: Task) => (
        <Tag>{statusLabel(record.status?.code, record.status?.name)}</Tag>
      ),
    },
    {
      title: "Приоритет",
      dataIndex: "priority",
      key: "priority",
      render: (v?: number) => riskLabel(v),
    },
    {
      title: "Прогресс",
      dataIndex: "progress",
      key: "progress",
      render: (v?: number | null) => `${v ?? 0}%`,
    },
    {
      title: "Действия",
      key: "actions",
      render: (_: unknown, record: Task) => (
        <Space>
          <Link to={`/tasks/${record.id}`}>
            <Button>Открыть</Button>
          </Link>
          <Popconfirm
            title="Удалить задачу?"
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button danger size="small">Удалить</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Table<Task>
        rowKey="id"
        dataSource={data}
        loading={loading}
        columns={columns}
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}
