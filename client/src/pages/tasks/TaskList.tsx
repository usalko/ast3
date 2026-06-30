import { useEffect, useState } from "react";
import { Table, Button, Space, Typography, Tag, Popconfirm, message, Tabs } from "antd";
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
  status: { name: string; code: string; order?: number };
};

const STATUS_ORDER: Record<string, number> = {
  in_progress: 1,
  todo: 2,
  backlog: 3,
  done: 4,
  cancelled: 5,
};

const ACTIVE_CODES = new Set(["todo", "in_progress"]);
const COMPLETED_CODES = new Set(["done", "cancelled"]);

export function TaskList() {
  const [data, setData] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("active");

  useEffect(() => {
    setLoading(true);
    gqlQuery<{ tasksAll: Task[] }>(
      `query { tasksAll { id code title type progress priority status { name code order } } }`
    )
      .then((res) => {
        const sorted = (res.tasksAll ?? []).sort(
          (a, b) => (STATUS_ORDER[a.status?.code] ?? 0) - (STATUS_ORDER[b.status?.code] ?? 0)
        );
        setData(sorted);
      })
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

  const filteredData = data.filter((t) =>
    tab === "active" ? ACTIVE_CODES.has(t.status?.code) : COMPLETED_CODES.has(t.status?.code)
  );

  const baseColumns = [
    {
      title: "Код",
      dataIndex: "code",
      key: "code",
      width: 200,
      render: (v?: string) => (v ? <Text code>{v}</Text> : "—"),
    },
    {
      title: "Название",
      dataIndex: "title",
      key: "title",
      render: (v: string, record: Task) => (
        <Link to={`/tasks/${record.id}/edit`}><Text strong>{v}</Text></Link>
      ),
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
          <Link to={`/tasks/${record.id}/edit`}>
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

  const columns = tab === "completed"
    ? baseColumns.filter((c) => c.key !== "progress")
    : baseColumns;

  return (
    <div style={{ padding: 16 }}>
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: "active", label: "К выполнению / В работе" },
        { key: "completed", label: "Выполненные / Отменённые" },
      ]} />
      <Table<Task>
        rowKey="id"
        dataSource={filteredData}
        loading={loading}
        columns={columns}
        pagination={false}
      />
    </div>
  );
}
