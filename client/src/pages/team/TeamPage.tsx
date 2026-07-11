import { useEffect, useState } from "react";
import { Table, message, Button, Modal, Form, Input, Card, Space, Tag, Select, Switch, Row, Col, Transfer } from "antd";
import { useGetIdentity } from "@refinedev/core";
import { gqlQuery } from "@/api/graphql";

type TaskInfo = { id: string; code: string; title: string; statusCode: string };

type User = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  patronymic?: string | null;
  position?: string | null;
  isActive?: boolean;
  department?: { id: string; name: string } | null;
  roles?: string[];
  tasks?: TaskInfo[];
};

type Identity = {
  id?: string;
  email?: string;
  fullName?: string;
  isStaff?: boolean;
  isSuperuser?: boolean;
};

type DepartmentOption = { id: string; name: string };
type RoleOption = { code: string; name: string };

const ALL_ROLES: RoleOption[] = [
  { code: "project_manager", name: "Project Manager" },
  { code: "security_officer", name: "Security Officer" },
  { code: "developer", name: "Developer" },
  { code: "viewer", name: "Viewer" },
];

export function TeamPage() {
  const { data: identity } = useGetIdentity<Identity>();
  const isAdmin = !!identity;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; userName: string } | null>(null);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editForm] = Form.useForm();
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editRoleKeys, setEditRoleKeys] = useState<string[]>([]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await gqlQuery<{ users: User[] }>(
        "query { users { id email firstName lastName patronymic position isActive department { id name } roles tasks { id code title statusCode } } }"
      );
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

  useEffect(() => { void loadUsers(); }, []);

  useEffect(() => {
    gqlQuery<{ departments: DepartmentOption[] }>("query { departments { id name } }")
      .then((res) => setDepartments(res.departments ?? []))
      .catch(() => {});
  }, []);

  const handleAddOk = async () => {
    try {
      const values = await addForm.validateFields();
      const fullName = String(values.fullName || "").trim();
      if (!fullName) { message.error("Укажите имя"); return; }
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
    const roles = user.roles || [];
    editForm.setFieldsValue({
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      patronymic: user.patronymic || "",
      position: user.position || "",
      departmentId: user.department?.id || null,
      isActive: user.isActive ?? true,
      roleCodes: roles,
    });
    setEditRoleKeys(roles);
    setEditTarget(user);
  };

  const handleEditOk = async () => {
    try {
      if (!editTarget) return;
      const values = await editForm.validateFields();
      setEditSaving(true);
      await gqlQuery(
        `mutation($id:ID!,$email:String,$password:String,$firstName:String,$lastName:String,$patronymic:String,$departmentId:ID,$position:String,$isActive:Boolean,$isStaff:Boolean,$isSuperuser:Boolean,$roleCodes:[String!]){updateUser(userId:$id,email:$email,password:$password,firstName:$firstName,lastName:$lastName,patronymic:$patronymic,departmentId:$departmentId,position:$position,isActive:$isActive,isStaff:$isStaff,isSuperuser:$isSuperuser,roleCodes:$roleCodes){id}}`,
        {
          id: editTarget.id,
          email: values.email,
          password: values.password || null,
          firstName: values.firstName,
          lastName: values.lastName || "",
          patronymic: values.patronymic || "",
          departmentId: values.departmentId || null,
          position: values.position || "",
          isActive: values.isActive,
          isStaff: values.isStaff ?? false,
          isSuperuser: values.isSuperuser ?? false,
          roleCodes: values.roleCodes || [],
        },
      );
      message.success("Данные сотрудника обновлены");
      setEditTarget(null);
      editForm.resetFields();
      void loadUsers();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Не удалось обновить данные${detail ? `: ${detail}` : ""}`);
    } finally {
      setEditSaving(false);
    }
  };

  const columns = [
    {
      title: "Сотрудник",
      key: "name",
      render: (_: unknown, record: User) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.firstName || record.email}</div>
          <div style={{ fontSize: 12, color: "#888" }}>{record.position || ""}</div>
        </div>
      ),
    },
    {
      title: "Права",
      key: "roles",
      render: (_: unknown, record: User) =>
        (record.roles ?? []).map((r) => (
          <Tag key={r} style={{ marginBottom: 2 }}>{r}</Tag>
        )) || "—",
    },
    {
      title: "Задачи",
      key: "tasks",
      render: (_: unknown, record: User) =>
        record.tasks && record.tasks.length > 0
          ? record.tasks.map((t) => (
              <Tag key={t.id} style={{ marginBottom: 2 }}>{t.title}</Tag>
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
            <Button size="small" onClick={() => handleEditClick(record)}>Редактировать</Button>
            <Button size="small" danger onClick={() => handleRemoveClick(record)}>Удалить</Button>
          </Space>
        ) : null,
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title="Управление сотрудниками"
        extra={isAdmin ? (
          <Button type="primary" onClick={() => setAddModalOpen(true)}>Добавить сотрудника</Button>
        ) : undefined}
      >
        <Table<User> rowKey="id" loading={loading} dataSource={users} columns={columns} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title="Добавить сотрудника" open={addModalOpen} onOk={handleAddOk} onCancel={() => { setAddModalOpen(false); addForm.resetFields(); }}>
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
        onCancel={() => { setEditTarget(null); editForm.resetFields(); setEditRoleKeys([]); }}
        width={700}
        confirmLoading={editSaving}
      >
        <Form form={editForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Email" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="password" label="Пароль (оставьте пустым, чтобы не менять)">
                <Input.Password placeholder="Новый пароль" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="firstName" label="Имя" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="lastName" label="Фамилия">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="patronymic" label="Отчество">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="departmentId" label="Отдел">
                <Select
                  allowClear
                  placeholder="Выберите отдел"
                  options={departments.map((d) => ({ label: d.name, value: d.id }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="position" label="Должность">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="isActive" label="Активен" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isStaff" label="Доступ в админку" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isSuperuser" label="Суперадмин" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="roleCodes" label="Роли">
            <Transfer
              dataSource={ALL_ROLES.map((r) => ({ key: r.code, title: r.name }))}
              targetKeys={editRoleKeys}
              onChange={(nextTargetKeys) => {
                setEditRoleKeys(nextTargetKeys);
                editForm.setFieldValue("roleCodes", nextTargetKeys);
              }}
              render={(item) => item.title}
              listStyle={{ width: 240, height: 200 }}
              titles={["Доступные роли", "Назначенные роли"]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Удалить сотрудника"
        open={!!removeTarget}
        onOk={handleRemoveOk}
        onCancel={() => setRemoveTarget(null)}
      >
        <p>Удалить сотрудника <strong>{removeTarget?.userName}</strong> из системы?</p>
      </Modal>
    </div>
  );
}
