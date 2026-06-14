import { useEffect } from "react";
import { Form, Input, Button, DatePicker, Card, message, Select } from "antd";

import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { gqlQuery } from "@/api/graphql";

type Project = {
  id?: string;
  code?: string;
  name?: string;
  description?: string;
  type?: string;
  plannedStart?: string | null;
  plannedEnd?: string | null;
};

type ProjectFormValues = Omit<Project, "plannedStart" | "plannedEnd"> & {
  plannedStart?: Dayjs | null;
  plannedEnd?: Dayjs | null;
};

export function ProjectForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    if (!id) return;
    gqlQuery<{ project: Project }>(`query ($id: ID!) { project(id: $id) { id code name description type plannedStart plannedEnd } }`, { id }).then((res) => {
      const p = res.project;
      form.setFieldsValue({ ...p, plannedStart: p?.plannedStart ? dayjs(p.plannedStart) : undefined, plannedEnd: p?.plannedEnd ? dayjs(p.plannedEnd) : undefined });
    });
  }, [id, form]);

  async function onFinish(values: ProjectFormValues) {
    try {
      const input = {
        code: values.code,
        name: values.name,
        description: values.description || "",
        type: values.type || "software",
        plannedStart: values.plannedStart ? values.plannedStart.format("YYYY-MM-DD") : null,
        plannedEnd: values.plannedEnd ? values.plannedEnd.format("YYYY-MM-DD") : null,
      };

      if (id) {
        await gqlQuery(`mutation ($id: ID!, $input: UpdateProjectInput!) { updateProject(id: $id, input: $input) { id } }`, { id, input });
        message.success("Проект обновлён");
      } else {
        await gqlQuery(`mutation ($input: CreateProjectInput!) { createProject(input: $input) { id } }`, { input });
        message.success("Проект создан");
      }
      navigate("/projects");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      message.error(`Ошибка при сохранении проекта${detail ? `: ${detail}` : ""}`);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <Card title={id ? "Редактировать проект" : "Создать проект"}>
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ code: "", name: "", description: "" }}>
          <Form.Item name="code" label="Код" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="type" label="Тип проекта">
            <Select
              options={[
                { label: "ПО", value: "software" },
                { label: "Производство", value: "hardware" },
                { label: "Исследования", value: "research" },
              ]}
            />
          </Form.Item>
          <Form.Item name="plannedStart" label="Плановый старт">
            <DatePicker />
          </Form.Item>
          <Form.Item name="plannedEnd" label="Плановый конец">
            <DatePicker />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Сохранить
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
