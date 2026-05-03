import { Form, Input, Button, Card, Typography } from "antd";
import { useLogin } from "@refinedev/core";

const { Title } = Typography;

export function LoginPage() {
  const { mutate: login, isLoading } = useLogin<{ email: string; password: string }>();

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f0f2f5" }}>
      <Card style={{ width: 360 }}>
        <Title level={3} style={{ textAlign: "center", marginBottom: 24 }}>AST3</Title>
        <Form
          layout="vertical"
          onFinish={(values) => login(values)}
          autoComplete="off"
        >
          <Form.Item label="Email" name="email" rules={[{ required: true, type: "email" }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item label="Пароль" name="password" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={isLoading}>
            Войти
          </Button>
        </Form>
      </Card>
    </div>
  );
}
