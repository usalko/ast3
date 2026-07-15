import { useEffect, useState, useCallback } from "react";
import { Table, message, Button, Modal, Form, Input, Card, Checkbox, Popconfirm, Space } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { useGetIdentity } from "@refinedev/core";
import { gqlQuery } from "@/api/graphql";

type User = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  patronymic?: string | null;
  isActive?: boolean;
  isStaff?: boolean;
  isSuperuser?: boolean;
  roles?: string[];
};

type Identity = {
  id?: string;
  email?: string;
  fullName?: string;
  isStaff?: boolean;
  isSuperuser?: boolean;
};

export function TeamPage() {
  const { data: identity } = useGetIdentity<Identity>();
  const isStaff = identity?.isStaff === true;
  const currentUserId = identity?.id;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [passwordModalOpen, setPasswordModalOpen] = useState<string | null>(null);
  const [passwordForm] = Form.useForm();
  const [nameModalOpen, setNameModalOpen] = useState<User | null>(null);
  const [nameForm] = Form.useForm();
  const [nameSaving, setNameSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await gqlQuery<{ users: User[] }>(
        "query { users { id email firstName lastName patronymic isActive isStaff isSuperuser roles } }"
      );
      const list = res.users ?? [];
      const filtered = list.filter((u) => !(u.roles || []).includes("admin"));
      const sorted = [...filtered].sort((a, b) => (a.firstName || a.email).localeCompare(b.firstName || b.email));
      setUsers(sorted);
    } catch {
      message.error("Не удалось загрузить сотрудников");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const handleAddOk = async () => {
    try {
      const values = await addForm.validateFields();
      const email = String(values.email || "").trim();
      const firstName = String(values.firstName || "").trim();
      const lastName = String(values.lastName || "").trim();
      const password = String(values.password || "ChangeMe123!");
      if (!email || !firstName) {
        message.error("Укажите email и имя");
        return;
      }
      await gqlQuery(
        `mutation($email:String!,$password:String!,$firstName:String!,$lastName:String!){register(email:$email,password:$password,firstName:$firstName,lastName:$lastName){id email}}`,
        { email, password, firstName, lastName },
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

  const handleToggle = async (user: User, field: "isStaff" | "isActive", checked: boolean) => {
    const currentValue = user[field] ?? false;
    if (checked === currentValue) return;
    try {
      await gqlQuery(
        `mutation($id:ID!,$val:Boolean!){updateUser(userId:$id,${field === "isStaff" ? "isStaff" : "isActive"}:$val){id}}`,
        { id: user.id, val: checked },
      );
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, [field]: checked } : u)));
      message.success(field === "isStaff" ? "Права администратора обновлены" : "Статус активности обновлён");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось обновить${detail ? `: ${detail}` : ""}`);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await gqlQuery(`mutation($userId:ID!){deleteUser(userId:$userId)}`, { userId });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      message.success("Сотрудник удалён");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось удалить сотрудника${detail ? `: ${detail}` : ""}`);
    }
  };

  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      if (!passwordModalOpen) return;
      await gqlQuery(
        `mutation($id:ID!,$pw:String!){changePassword(userId:$id,newPassword:$pw){id}}`,
        { id: passwordModalOpen, pw: values.newPassword },
      );
      message.success("Пароль изменён");
      setPasswordModalOpen(null);
      passwordForm.resetFields();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось сменить пароль${detail ? `: ${detail}` : ""}`);
    }
  };

  const handleEditNameClick = (user: User) => {
    nameForm.setFieldsValue({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      patronymic: user.patronymic || "",
    });
    setNameModalOpen(user);
  };

  const handleEditNameOk = async () => {
    try {
      if (!nameModalOpen) return;
      const values = await nameForm.validateFields();
      setNameSaving(true);
      await gqlQuery(
        `mutation($id:ID!,$firstName:String,$lastName:String,$patronymic:String){updateUser(userId:$id,firstName:$firstName,lastName:$lastName,patronymic:$patronymic){id}}`,
        {
          id: nameModalOpen.id,
          firstName: values.firstName,
          lastName: values.lastName || "",
          patronymic: values.patronymic || "",
        },
      );
      message.success("Имя обновлено");
      setNameModalOpen(null);
      nameForm.resetFields();
      void loadUsers();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось обновить имя${detail ? `: ${detail}` : ""}`);
    } finally {
      setNameSaving(false);
    }
  };

  const canDelete = (user: User) =>
    user.id !== currentUserId && !user.isSuperuser;

  const columns = [
    {
      title: "Учётная запись",
      key: "email",
      render: (_: unknown, record: User) => record.email,
    },
    {
      title: "Имя",
      key: "name",
      render: (_: unknown, record: User) => {
        const full = [record.lastName, record.firstName, record.patronymic].filter(Boolean).join(" ");
        return (
          <Space>
            <span>{full || "—"}</span>
            {isStaff && (
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEditNameClick(record)}
              />
            )}
          </Space>
        );
      },
    },
    {
      title: "Пароль",
      key: "password",
      width: 120,
      render: (_: unknown, record: User) =>
        isStaff ? (
          <Button
            size="small"
            onClick={() => { passwordForm.resetFields(); setPasswordModalOpen(record.id); }}
          >
            Сменить пароль
          </Button>
        ) : null,
    },
    {
      title: "Администратор",
      key: "isStaff",
      width: 140,
      render: (_: unknown, record: User) => (
        <Checkbox
          checked={record.isStaff ?? false}
          disabled={!isStaff || record.isSuperuser}
          onChange={(e) => handleToggle(record, "isStaff", e.target.checked)}
        />
      ),
    },
    {
      title: "Активен",
      key: "isActive",
      width: 100,
      render: (_: unknown, record: User) => (
        <Checkbox
          checked={record.isActive ?? true}
          disabled={!isStaff || record.isSuperuser}
          onChange={(e) => handleToggle(record, "isActive", e.target.checked)}
        />
      ),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      render: (_: unknown, record: User) =>
        isStaff && canDelete(record) ? (
          <Popconfirm
            title="Удалить сотрудника?"
            onConfirm={() => handleDelete(record.id)}
            okText="Удалить"
            cancelText="Отмена"
          >
            <Button size="small" danger>Удалить</Button>
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title="Управление сотрудниками"
        extra={isStaff ? (
          <Button type="primary" onClick={() => setAddModalOpen(true)}>Добавить сотрудника</Button>
        ) : undefined}
      >
        <Table<User>
          rowKey="id"
          loading={loading}
          dataSource={users}
          columns={columns}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="Добавить сотрудника"
        open={addModalOpen}
        onOk={handleAddOk}
        onCancel={() => { setAddModalOpen(false); addForm.resetFields(); }}
      >
        <Form form={addForm} layout="vertical">
          <Form.Item name="email" label="Email (учётная запись)" rules={[{ required: true, type: "email" }]}>
            <Input placeholder="user@example.com" />
          </Form.Item>
          <Form.Item name="firstName" label="Имя" rules={[{ required: true }]}>
            <Input placeholder="Имя" />
          </Form.Item>
          <Form.Item name="lastName" label="Фамилия">
            <Input placeholder="Фамилия" />
          </Form.Item>
          <Form.Item name="password" label="Пароль">
            <Input.Password placeholder="ChangeMe123!" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Сменить пароль"
        open={passwordModalOpen !== null}
        onOk={handleChangePassword}
        onCancel={() => { setPasswordModalOpen(null); passwordForm.resetFields(); }}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="newPassword"
            label="Новый пароль"
            rules={[{ required: true, min: 6, message: "Минимум 6 символов" }]}
          >
            <Input.Password placeholder="Новый пароль" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Редактировать имя"
        open={nameModalOpen !== null}
        onOk={handleEditNameOk}
        onCancel={() => { setNameModalOpen(null); nameForm.resetFields(); }}
        confirmLoading={nameSaving}
      >
        <Form form={nameForm} layout="vertical">
          <Form.Item name="lastName" label="Фамилия">
            <Input placeholder="Фамилия" />
          </Form.Item>
          <Form.Item name="firstName" label="Имя" rules={[{ required: true, message: "Укажите имя" }]}>
            <Input placeholder="Имя" />
          </Form.Item>
          <Form.Item name="patronymic" label="Отчество">
            <Input placeholder="Отчество" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
