import { useEffect, useState } from "react";
import { Table, message, Button, Modal, Form, Input, Card, Space, Tag } from "antd";
import { useGetIdentity } from "@refinedev/core";
import { gqlQuery } from "@/api/graphql";

type Project = { id: string; code?: string; name: string };

type User = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  roles?: string[];
  projects?: Project[];
};

type Identity = {
  id?: string;
  email?: string;
  fullName?: string;
};

export function TeamPage() {
  const { data: identity } = useGetIdentity<Identity>();
  const isAdmin = identity?.email === "admin@test.local";
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; userName: string } | null>(null);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editForm] = Form.useForm();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await gqlQuery<{ users: User[] }>("query { users { id email firstName roles projects { id code name } } }");
      const list = res.users ?? [];
      const filtered = list.filter((u) => !(u.roles || []).includes("admin") && u.email !== "admin@test.local");
      const sorted = [...filtered].sort((a, b) => (a.firstName || a.email).localeCompare(b.firstName || b.email));
      setUsers(sorted);
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
      const fullName = String(values.fullName || "").trim();
      if (!fullName) {
        message.error("Укажите имя");
        return;
      }
      const email = `${fullName.toLowerCase().replace(/\s+/g, ".")}@svr10.local`;
      await gqlQuery(
        `mutation($email:String!,$password:String!,$firstName:String!,$lastName:String!){register(email:$email,password:$password,firstName:$firstName,lastName:$lastName){id email}}`,
        { email, password: "ChangeMe123!", firstName: fullName, lastName: fullName },
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
    setRemoveTarget({ userId: user.id, userName: user.firstName || user.email });
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

  const handleEditClick = (user: User) => {
    editForm.setFieldsValue({ firstName: user.firstName || "" });
    setEditTarget(user);
  };

  const handleEditOk = async () => {
    try {
      if (!editTarget) return;
      const values = await editForm.validateFields();
      await gqlQuery(
        `mutation($userId:ID!,$firstName:String!){updateEmployee(userId:$userId,firstName:$firstName,lastName:""){id firstName}}`,
        { userId: editTarget.id, firstName: values.firstName },
      );
      message.success("Имя изменено");
      setEditTarget(null);
      editForm.resetFields();
      void loadUsers();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось изменить имя${detail ? `: ${detail}` : ""}`);
    }
  };

  const columns = [
    {
      title: "Имя",
      key: "name",
      render: (_: unknown, record: User) => (
        <Space>
          <span>{record.firstName || record.email}</span>
        </Space>
      ),
    },
    {
      title: "Проекты",
      key: "projects",
      render: (_: unknown, record: User) =>
        record.projects && record.projects.length > 0
          ? record.projects.map((p) => (
              <Tag key={p.id} style={{ marginBottom: 2 }}>
                {p.code ? `[${p.code}] ${p.name}` : p.name}
              </Tag>
            ))
          : <span style={{ opacity: 0.5 }}>—</span>,
    },
    {
      title: "Действия",
      key: "actions",
      width: 200,
      render: (_: unknown, record: User) =>
        isAdmin ? (
          <Space>
            <Button size="small" onClick={() => handleEditClick(record)}>
              Редактировать
            </Button>
            <Button size="small" danger onClick={() => handleRemoveClick(record)}>
              Удалить
            </Button>
          </Space>
        ) : null,
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title="Управление сотрудниками"
        extra={
          isAdmin ? (
            <Button type="primary" onClick={() => setAddModalOpen(true)}>
              Добавить сотрудника
            </Button>
          ) : undefined
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
          <Form.Item name="fullName" label="Имя" rules={[{ required: true }]}>
            <Input placeholder="Введите имя" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Редактировать сотрудника"
        open={!!editTarget}
        onOk={handleEditOk}
        onCancel={() => {
          setEditTarget(null);
          editForm.resetFields();
        }}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="firstName" label="Имя" rules={[{ required: true }]}>
            <Input placeholder="Введите имя" />
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
