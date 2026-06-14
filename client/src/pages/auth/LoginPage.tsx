import { useState } from "react";
import { Form, Input, Button, Card, message, theme } from "antd";
import { useNavigate } from "react-router-dom";
import { gqlQuery } from "@/api/graphql";

const TOKEN_KEY = "ast3_access";
const REFRESH_KEY = "ast3_refresh";

export function LoginPage() {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: Record<string, unknown>) {
    setLoading(true);
    try {
      const response = await gqlQuery<{
        tokenObtainPair?: { access: string; refresh: string };
      }>(
        `mutation Login($email: String!, $password: String!) {
          tokenObtainPair(email: $email, password: $password) {
            access refresh
          }
        }`,
        { email: values.email, password: values.password }
      );

      const tokens = response.tokenObtainPair;
      if (!tokens || !tokens.access) {
        message.error("Ошибка авторизации: неверные учётные данные");
        return;
      }

      localStorage.setItem(TOKEN_KEY, tokens.access);
      localStorage.setItem(REFRESH_KEY, tokens.refresh);
      message.success("Добро пожаловать!");
      navigate("/projects");
    } catch (err) {
      message.error("Ошибка авторизации. Проверьте email и пароль.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: token.colorBgLayout,
      }}
    >
      <Card style={{ width: 400 }} title="Вход в AST3">
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Введите email" },
              { type: "email", message: "Неверный формат email" },
            ]}
          >
            <Input type="email" placeholder="user@example.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: "Введите пароль" }]}
          >
            <Input.Password placeholder="Введите пароль" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
            >
              Войти
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
