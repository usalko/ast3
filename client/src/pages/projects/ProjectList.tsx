import { useEffect, useState } from "react";
import { Table, Button, Space, Typography } from "antd";
import { Link } from "react-router-dom";
import { gqlQuery } from "@/api/graphql";

const { Text } = Typography;

type Project = {
  id: string;
  code?: string;
  name: string;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  type?: string;
  status?: string;
  progress?: number | null;
};

export function ProjectList() {
  const [data, setData] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    gqlQuery<{ projects: Project[] }>(`query { projects { id code name plannedStart plannedEnd type status progress } }`)
      .then((res) => setData(res.projects || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12 }}>
        <Link to="/projects/new">
          <Button type="primary">Создать проект</Button>
        </Link>
      </Space>

      <Table<Project>
        rowKey="id"
        dataSource={data}
        loading={loading}
        pagination={{ pageSize: 10 }}
      >
        <Table.Column<Project> title="Код" dataIndex="code" key="code" render={(v) => <Text code>{v}</Text>} />
        <Table.Column<Project> title="Название" dataIndex="name" key="name" render={(v, r) => <Link to={`/projects/${r.id}`}>{v}</Link>} />
        <Table.Column<Project> title="Тип" dataIndex="type" key="type" render={(v) => projectTypeLabel(v)} />
        <Table.Column<Project> title="Статус" dataIndex="status" key="status" render={(v) => projectStatusLabel(v)} />
        <Table.Column<Project> title="План старт" dataIndex="plannedStart" key="plannedStart" />
        <Table.Column<Project> title="План конец" dataIndex="plannedEnd" key="plannedEnd" />
        <Table.Column<Project> title="Прогресс" dataIndex="progress" key="progress" render={(v) => (v ?? 0) + "%"} />
        <Table.Column<Project>
          title="Действия"
          key="actions"
          render={(_, record) => (
            <Space>
              <Link to={`/projects/${record.id}`}>
                <Button>Открыть</Button>
              </Link>
              <Link to={`/kanban?projectId=${record.id}`}>
                <Button>Канбан</Button>
              </Link>
              <Link to={`/projects/${record.id}/gantt`}>
                <Button>Gantt</Button>
              </Link>
            </Space>
          )}
        />
      </Table>
    </div>
  );
}

function projectTypeLabel(value?: string) {
  if (value === "hardware") return "Производство";
  if (value === "research") return "Исследования";
  return "ПО";
}

function projectStatusLabel(value?: string) {
  if (value === "active") return "Активен";
  if (value === "on_hold") return "На паузе";
  if (value === "completed") return "Завершён";
  if (value === "cancelled") return "Отменён";
  return value ?? "—";
}
