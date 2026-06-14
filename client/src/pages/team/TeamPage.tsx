import { useEffect, useState } from "react";
import { Table, message, Button, Modal, Form, Input, Card, Tag, Space, Tooltip } from "antd";
import { gqlQuery } from "@/api/graphql";

type Task = {
  id: string;
  code: string;
  title: string;
  projectId?: string;
  status: { code: string; name: string; color: string };
  assignee?: { id: string } | null;
};

type User = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  roles?: string[];
  assignedTasks?: Task[];
};

export function TeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; userName: string } | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await gqlQuery<{ users: User[] }>("query { users { id email firstName lastName fullName roles } }");
      const list = res.users ?? [];
      const filtered = list.filter((u) => !(u.roles || []).includes("admin") && u.email !== "admin@test.local");
      
      // Try to fetch tasks, but don't block the page if it fails
      try {
        const tasksRes = await gqlQuery<{ tasksAll: Task[] }>(`query { 
          tasksAll { 
            id code title 
            projectId
            status { code name color } 
            assignee { id } 
          } 
        }`);
        const tasks = tasksRes.tasksAll ?? [];
        
        const tasksByAssignee = new Map<string, Task[]>();
        for (const task of tasks) {
          if (task.assignee?.id) {
            const existing = tasksByAssignee.get(task.assignee.id) ?? [];
            existing.push(task);
            tasksByAssignee.set(task.assignee.id, existing);
          }
        }
        
        const usersWithTasks = filtered.map(u => ({
          ...u,
          assignedTasks: tasksByAssignee.get(u.id) ?? []
        }));
        
        setUsers(usersWithTasks);
      } catch {
        // Tasks query failed, show users without task info
        setUsers(filtered);
      }
    } catch {
      message.error("Не удалось загрузить сотрудников");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleAddOk = async () => {
    try {
      const values = await addForm.validateFields();
      const first = String(values.firstName || "").trim();
      const last = String(values.lastName || "").trim();
      if (!first || !last) {
        message.error("Укажите имя и фамилию");
        return;
      }
      const email = `${first.toLowerCase()}.${last.toLowerCase()}@example.com`;
      await gqlQuery(
        `mutation($email:String!,$password:String!,$firstName:String!,$lastName:String!){register(email:$email,password:$password,firstName:$firstName,lastName:$lastName){id email}}`,
        { email, password: "ChangeMe123!", firstName: first, lastName: last },
      );
      message.success("Сотрудник добавлен");
      setAddModalOpen(false);
      addForm.resetFields();
      void loadUsers();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось добавить сотрудника${detail ? `: ${detail}` : ""}`);
    }
  };

  const handleRemoveClick = (user: User) => {
    setRemoveTarget({ userId: user.id, userName: user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email });
  };

  const handleRemoveOk = async () => {
    try {
      if (!removeTarget) return;
      await gqlQuery(`mutation($userId:ID!){deleteUser(userId:$userId)}`, { userId: removeTarget.userId });
      setUsers((current) => current.filter((u) => u.id !== removeTarget.userId));
      message.success("Сотрудник удалён из системы");
      setRemoveTarget(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось удалить сотрудника${detail ? `: ${detail}` : ""}`);
    }
  };

  const columns = [
    {
      title: "Сотрудник",
      key: "name",
      render: (_: unknown, record: User) => (
        <Space>
          <span>{record.fullName || `${record.firstName || ""} ${record.lastName || ""}`.trim() || record.email}</span>
          {record.roles?.length ? <span>{renderRoles(record.roles)}</span> : null}
        </Space>
      ),
    },
    {
      title: "Задачи (исполнитель)",
      key: "tasks",
      width: 300,
      render: (_: unknown, record: User) => {
        const tasks = record.assignedTasks ?? [];
        if (!tasks.length) return <span style={{ color: "#999" }}>Нет задач</span>;
        return (
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            {tasks.map((task) => (
              <Tooltip key={task.id} title={task.title}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Tag color={task.status.color} style={{ fontSize: 11 }}>
                    {task.status.name}
                  </Tag>
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <strong>{task.code}</strong> — {task.title}
                  </span>
                  <span style={{ color: "#999", fontSize: 12 }}>Проект: {task.projectId}</span>
                </span>
              </Tooltip>
            ))}
          </Space>
        );
      },
    },
    {
      title: "Действия",
      key: "actions",
      width: 160,
      render: (_: unknown, record: User) => (
        <Button size="small" danger onClick={() => handleRemoveClick(record)}>
          Удалить
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title="Управление сотрудниками"
        extra={
          <Button type="primary" onClick={() => setAddModalOpen(true)}>
            Добавить сотрудника
          </Button>
        }
      >
        <Table<User>
          rowKey="id"
          loading={loading}
          dataSource={users}
          columns={columns}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="Добавить сотрудника"
        open={addModalOpen}
        onOk={handleAddOk}
        onCancel={() => {
          setAddModalOpen(false);
          addForm.resetFields();
        }}
      >
        <Form form={addForm} layout="vertical">
          <Form.Item name="firstName" label="Имя" rules={[{ required: true }]}>
            <Input placeholder="Имя" />
          </Form.Item>
          <Form.Item name="lastName" label="Фамилия" rules={[{ required: true }]}>
            <Input placeholder="Фамилия" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Удалить сотрудника"
        open={!!removeTarget}
        onOk={handleRemoveOk}
        onCancel={() => setRemoveTarget(null)}
      >
        <p>
          Удалить сотрудника <strong>{removeTarget?.userName}</strong> из системы?
        </p>
      </Modal>
    </div>
  );
}

function renderRoles(roles?: string[]) {
  if (!roles || roles.length === 0) return null;
  return (
    <Space size={[0, 4]} wrap>
      {roles.map((r) => (
        <Tag key={r}>{r}</Tag>
      ))}
    </Space>
  );
}
