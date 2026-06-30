import { Form, Input, Button, Card, message, theme } from "antd";
import { useLogin } from "@refinedev/core";

export function LoginPage() {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const { mutate: login, isLoading } = useLogin();

  function onFinish(values: Record<string, unknown>) {
    login(
      { email: values.email, password: values.password },
      {
        onSuccess: (result) => {
          if (result?.success) {
            message.success("Добро пожаловать!");
          } else {
            const errMsg = result?.error?.name ? `${result.error.name}: ${result.error.message}` : "Неверные учётные данные";
            message.error(errMsg);
          }
        },
        onError: (err: unknown) => {
          console.error("Login error:", err);
          const msg = err instanceof Error ? err.message : JSON.stringify(err);
          message.error(`Ошибка авторизации: ${msg}`);
        },
      },
    );
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
              loading={isLoading}
            >
              Войти
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
