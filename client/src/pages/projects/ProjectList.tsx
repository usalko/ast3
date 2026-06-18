import { useEffect, useState } from "react";
import { Table, Button, Space, Typography, Popconfirm, message } from "antd";
import { Link } from "react-router-dom";
import { gqlQuery } from "@/api/graphql";

const { Text } = Typography;

type ProjectWithTasks = {
  id: string;
  code?: string;
  name: string;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  type?: string;
  status?: string;
  progress?: number | null;
  taskCount?: number;
};

export function ProjectList() {
  const [data, setData] = useState<ProjectWithTasks[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    gqlQuery<{ projects: ProjectWithTasks[] }>(`query { projects { id code name plannedStart plannedEnd type status progress } }`)
      .then(async (res) => {
        const list = res.projects || [];
        const withCounts = await Promise.all(
          list.map(async (p) => {
            try {
              const r = await gqlQuery<{ tasks: { id: string }[] }>(
                `query ($pid: ID!) { tasks(projectId: $pid) { id } }`,
                { pid: p.id }
              );
              return { ...p, taskCount: r.tasks?.length ?? 0 };
            } catch {
              return { ...p, taskCount: 0 };
            }
          })
        );
        setData(withCounts);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(projectId: string) {
    try {
      await gqlQuery(`mutation ($id: ID!) { deleteProject(id: $id) { success } }`, { id: projectId });
      setData((current) => current.filter((project) => project.id !== projectId));
      message.success("Проект удалён");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось удалить проект${detail ? `: ${detail}` : ""}`);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12 }}>
        <Link to="/projects/new">
          <Button type="primary">Создать проект</Button>
        </Link>
      </Space>

      <Table<ProjectWithTasks>
        rowKey="id"
        dataSource={data}
        loading={loading}
        pagination={{ pageSize: 10 }}
      >
        <Table.Column<ProjectWithTasks> title="Код" dataIndex="code" key="code" render={(v) => <Text code>{v}</Text>} />
        <Table.Column<ProjectWithTasks> title="Название" dataIndex="name" key="name" render={(v, r) => <Link to={`/projects/${r.id}`} style={{ color: "#000" }}>{v}</Link>} />
        <Table.Column<ProjectWithTasks> title="Тип" dataIndex="type" key="type" render={(v) => projectTypeLabel(v)} />
        <Table.Column<ProjectWithTasks> title="Задачи" key="taskCount" render={(_, r) => r.taskCount ?? 0} />
        <Table.Column<ProjectWithTasks> title="План старт" dataIndex="plannedStart" key="plannedStart" />
        <Table.Column<ProjectWithTasks> title="План конец" dataIndex="plannedEnd" key="plannedEnd" />
        <Table.Column<ProjectWithTasks> title="Прогресс" dataIndex="progress" key="progress" render={(v) => (v ?? 0) + "%"} />
        <Table.Column<ProjectWithTasks>
          title="Действия"
          key="actions"
          render={(_, record) => (
            <Space>
              <Link to={`/projects/${record.id}`}>
                <Button>Открыть</Button>
              </Link>
              <Popconfirm
                title="Удалить проект?"
                description="Все задачи проекта будут переведены в статус «Отменено»."
                okText="Удалить"
                cancelText="Отмена"
                onConfirm={() => handleDelete(record.id)}
              >
                <Button danger>Удалить</Button>
              </Popconfirm>
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
