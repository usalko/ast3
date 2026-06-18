import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card, Col, Progress, Row, Statistic, Table, Tag, Typography, Empty, Spin, Tooltip, theme } from "antd";
import { CheckCircleFilled, ClockCircleFilled, ExclamationCircleFilled, ProjectFilled, UnorderedListOutlined, UserOutlined, TeamOutlined, FireOutlined } from "@ant-design/icons";
import { gqlQuery } from "@/api/graphql";

type Department = { id: string; name: string; code?: string };
type User = { id: string; firstName?: string | null; fullName?: string | null; department?: Department | null };
type Project = {
  id: string; code?: string; name: string; type?: string; status?: string;
  progress?: number | null; plannedStart?: string | null; plannedEnd?: string | null;
  actualStart?: string | null; actualEnd?: string | null;
  department?: Department | null; lead?: User | null;
};
type TaskStatus = { id: string; name: string; code: string; isDone?: boolean; isCancelled?: boolean };
type Task = {
  id: string; code?: string; title: string; progress?: number | null;
  estimatedHours?: number | null; priority?: number;
  isOverdue?: boolean | null; status: TaskStatus;
  assignees?: User[]; project?: { id: string; code?: string; name: string } | null;
};
type TimeEntry = {
  id: string; durationMinutes?: number | null; durationHours?: number | null;
  task: { id: string }; user?: User | null;
};

const { Text, Title: TypTitle } = Typography;

async function safeQuery<T>(query: string, vars?: Record<string, unknown>): Promise<T | null> {
  try {
    return await gqlQuery<T>(query, vars ?? {});
  } catch (e) {
    console.error("[Analytics] query failed:", query.slice(0, 80), e);
    return null;
  }
}

function projectTypeLabel(value?: string) {
  if (value === "hardware") return "Производство";
  if (value === "research") return "Исследования";
  return "ПО";
}

function monthKey(date: string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function round(v: number) { return Math.round(v * 10) / 10; }

function blackProgress(v: number) { return <Progress percent={v} size="small" strokeColor="#000" success={{ percent: v, strokeColor: "#000" }} />; }

function blackTag(label: ReactNode) {
  return <Tag style={{ color: "#000", borderColor: "#000", background: "#fff" }}>{label}</Tag>;
}

export function AnalyticsPage() {
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});
  const [entriesByProject, setEntriesByProject] = useState<Record<string, TimeEntry[]>>({});

  useEffect(() => {
    setLoading(true);
    safeQuery<{ projects: Project[] }>(`query {
      projects {
        id code name type status progress plannedStart plannedEnd actualStart actualEnd
        department { id name code }
        lead { id fullName }
      }
    }`).then((res) => {
      const list = res?.projects ?? [];
      setProjects(list);
      if (list.length === 0) { setLoading(false); return; }

      Promise.all(list.map(async (p) => {
        const [tr, er] = await Promise.all([
          safeQuery<{ tasks: Task[] }>(`query ($pid: ID!) {
            tasks(projectId: $pid) {
              id code title progress estimatedHours priority isOverdue
              status { id name code isDone }
              assignees { id firstName fullName department { id name code } }
            }
          }`, { pid: p.id }),
          safeQuery<{ timeEntries: TimeEntry[] }>(`query ($pid: ID!) {
            timeEntries(projectId: $pid, includeAll: true) {
              id durationMinutes durationHours task { id } user { id fullName }
            }
          }`, { pid: p.id }),
        ]);
        return { id: p.id, tasks: tr?.tasks ?? [], entries: er?.timeEntries ?? [] };
      })).then((results) => {
        const tMap: Record<string, Task[]> = {};
        const eMap: Record<string, TimeEntry[]> = {};
        for (const r of results) { tMap[r.id] = r.tasks; eMap[r.id] = r.entries; }
        setTasksByProject(tMap);
        setEntriesByProject(eMap);
        setLoading(false);
      });
    }).catch((err) => { console.error("[Analytics] fail:", err); setLoading(false); });
  }, []);

  const allTasks = useMemo(() => {
    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const flat: Task[] = [];
    for (const pid of Object.keys(tasksByProject)) {
      const project = projectMap.get(pid);
      for (const t of tasksByProject[pid] ?? []) {
        if (t.status.code !== "backlog") {
          flat.push({ ...t, project });
        }
      }
    }
    return flat;
  }, [tasksByProject, projects]);

  const highPriorityTasksList = useMemo(() => allTasks.filter((t) => (t.priority ?? 0) >= 3), [allTasks]);
  const activeProjects = useMemo(() => projects.filter((p) => p.status === "active"), [projects]);

  const timeline = useMemo(() => {
    const projectMonths: { project: Project; months: string[]; color: string }[] = [];
    const colors = ["#000", "#333", "#666", "#999", "#111", "#444", "#777", "#aaa"];
    const now = new Date();
    const currYear = now.getFullYear();
    const currM = now.getMonth() + 1;
    let minY = currYear, minM = currM, maxY = currYear, maxM = currM;

    // Find earliest start and latest end
    projects.forEach((p) => {
      const s = p.actualStart || p.plannedStart;
      const e = p.actualEnd || p.plannedEnd;
      if (s) { const [y, m] = monthKey(s).split("-").map(Number); if (y < minY || (y === minY && m < minM)) { minY = y; minM = m; } }
      if (e) { const [y, m] = monthKey(e).split("-").map(Number); if (y > maxY || (y === maxY && m > maxM)) { maxY = y; maxM = m; } }
    });

    // Expand to cover at least 1 year (6 months before start, 6 months after end)
    minM -= 2; while (minM < 1) { minM += 12; minY--; }
    maxM += 2; while (maxM > 12) { maxM -= 12; maxY++; }

    const sortedMonths: string[] = [];
    let yy = minY, mm = minM;
    while (yy < maxY || (yy === maxY && mm <= maxM)) {
      sortedMonths.push(`${yy}-${String(mm).padStart(2, "0")}`);
      if (mm === 12) { yy++; mm = 1; } else { mm++; }
    }
    const monthSet = new Set(sortedMonths);

    projects.forEach((p, idx) => {
      const start = p.actualStart || p.plannedStart;
      const end = p.actualEnd || p.plannedEnd;
      if (!start) return;
      const from = monthKey(start);
      const to = end ? monthKey(end) : monthKey(new Date().toISOString());
      const months: string[] = [];
      let [y, m] = from.split("-").map(Number);
      const [ty, tm] = to.split("-").map(Number);
      while (y < ty || (y === ty && m <= tm)) {
        const key = `${y}-${String(m).padStart(2, "0")}`;
        if (monthSet.has(key)) months.push(key);
        if (m === 12) { y++; m = 1; } else { m++; }
      }
      projectMonths.push({ project: p, months, color: colors[idx % colors.length] });
    });

    return { projectMonths, sortedMonths };
  }, [projects]);

  const projectRows = useMemo(() => {
    return projects.map((p) => {
      const tasks = tasksByProject[p.id]?.filter((t) => t.status.code !== "backlog") ?? [];
      const entries = entriesByProject[p.id] ?? [];
      const done = tasks.filter((t) => t.status.isDone || t.status.code === "done").length;
      const cancelled = tasks.filter((t) => t.status.isCancelled || t.status.code === "cancelled").length;
      const overdue = tasks.filter((t) => t.isOverdue).length;
      const highPriority = tasks.filter((t) => (t.priority ?? 0) >= 3).length;
      const avgProgress = tasks.length === 0 ? 0 : Math.round(tasks.reduce((s, t) => s + (t.progress ?? 0), 0) / tasks.length);
      const estimatedHours = tasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);
      const actualHours = entries.reduce((s, e) => s + (e.durationHours ?? (e.durationMinutes ?? 0) / 60), 0);
      const members = new Set<string>();
      entries.forEach((e) => { if (e.user?.id) members.add(e.user.id); });
      tasks.forEach((t) => { (t.assignees ?? []).forEach((a) => { if (a.id) members.add(a.id); }); });
      return { project: p, tasks, done, cancelled, overdue, highPriority, avgProgress, estimatedHours, actualHours, members: members.size };
    });
  }, [projects, tasksByProject, entriesByProject]);

  const peopleRows = useMemo(() => {
    const g = new Map<string, { user: User; tasks: number; done: number; overdue: number; progress: number[]; hours: number; projects: Set<string> }>();
    for (const p of projects) {
      const pTasks = tasksByProject[p.id]?.filter((t) => t.status.code !== "backlog") ?? [];
      const pEntries = entriesByProject[p.id] ?? [];
      for (const task of pTasks) {
        const assigneeList = task.assignees ?? [];
        if (assigneeList.length === 0) {
          const c = g.get("unassigned") ?? { user: { id: "unassigned", fullName: "Без исполнителя", department: null }, tasks: 0, done: 0, overdue: 0, progress: [], hours: 0, projects: new Set() };
          c.tasks += 1;
          if (task.status.isDone || task.status.code === "done") c.done += 1;
          if (task.isOverdue) c.overdue += 1;
          c.progress.push(task.progress ?? 0);
          c.projects.add(p.name);
          g.set("unassigned", c);
        }
        for (const u of assigneeList) {
        const c = g.get(u.id) ?? { user: u, tasks: 0, done: 0, overdue: 0, progress: [], hours: 0, projects: new Set() };
        c.tasks += 1;
        if (task.status.isDone || task.status.code === "done") c.done += 1;
        if (task.isOverdue) c.overdue += 1;
        c.progress.push(task.progress ?? 0);
        c.projects.add(p.name);
        g.set(u.id, c);
      }
      }
      for (const entry of pEntries) {
        if (entry.user?.id) {
          const c = g.get(entry.user.id);
          if (c) c.hours += entry.durationHours ?? (entry.durationMinutes ?? 0) / 60;
        }
      }
    }
    return [...g.values()].map((r) => ({
      ...r, avgProgress: r.progress.length === 0 ? 0 : Math.round(r.progress.reduce((s, v) => s + v, 0) / r.progress.length), projectCount: r.projects.size,
    })).sort((a, b) => b.tasks - a.tasks);
  }, [projects, tasksByProject, entriesByProject]);

  const deptRows = useMemo(() => {
    const g = new Map<string, { name: string; tasks: number; done: number; overdue: number; progress: number[]; hours: number; people: Set<string> }>();
    for (const r of peopleRows) {
      const deptName = r.user.department?.name ?? "Без подразделения";
      const c = g.get(deptName) ?? { name: deptName, tasks: 0, done: 0, overdue: 0, progress: [], hours: 0, people: new Set() };
      c.tasks += r.tasks; c.done += r.done; c.overdue += r.overdue;
      c.progress.push(r.avgProgress); c.hours += r.hours; c.people.add(r.user.id);
      g.set(deptName, c);
    }
    return [...g.values()].map((r) => ({ ...r, avgProgress: r.progress.length === 0 ? 0 : Math.round(r.progress.reduce((s, v) => s + v, 0) / r.progress.length), peopleCount: r.people.size }));
  }, [peopleRows]);

  const totals = useMemo(() => {
    const taskCount = allTasks.length;
    const doneCount = allTasks.filter((t) => t.status.isDone || t.status.code === "done").length;
    const cancelledCount = allTasks.filter((t) => t.status.isCancelled || t.status.code === "cancelled").length;
    const overdueCount = allTasks.filter((t) => t.isOverdue).length;
    const highPriorityCount = allTasks.filter((t) => (t.priority ?? 0) >= 3).length;
    const avgProgress = taskCount === 0 ? 0 : Math.round(allTasks.reduce((s, t) => s + (t.progress ?? 0), 0) / taskCount);
    const actualHours = Object.values(entriesByProject).flat().reduce((s, e) => s + (e.durationHours ?? (e.durationMinutes ?? 0) / 60), 0);
    return { taskCount, doneCount, cancelledCount, overdueCount, highPriorityCount, avgProgress, projectCount: projects.length, activeCount: activeProjects.length, actualHours };
  }, [allTasks, entriesByProject, activeProjects, projects]);

  return (
    <div style={{ padding: 16, background: token.colorBgLayout, minHeight: "100vh" }}>
      <Spin spinning={loading}>
        <div style={{ marginBottom: 24 }}>
          <TypTitle level={4} style={{ margin: 0 }}>Аналитика</TypTitle>
          <Text style={{ color: "#000", opacity: 0.55 }}>Статистика по проектам, людям и загрузке</Text>
        </div>

        <Row gutter={[12, 12]}>
          <Col xs={12} lg={3}><Card size="small"><Statistic title="Проекты" value={totals.projectCount} suffix={`/ ${totals.activeCount} акт.`} prefix={<ProjectFilled style={{ color: "#000" }} />} /></Card></Col>
          <Col xs={12} lg={3}><Card size="small"><Statistic title="Задачи" value={totals.taskCount} prefix={<UnorderedListOutlined style={{ color: "#000" }} />} /></Card></Col>
          <Col xs={12} lg={3}><Card size="small"><Statistic title="Готово" value={totals.doneCount} suffix={`/ ${totals.taskCount}`} prefix={<CheckCircleFilled style={{ color: "#000" }} />} /></Card></Col>
          <Col xs={12} lg={3}><Card size="small"><Statistic title="Отменено" value={totals.cancelledCount} /></Card></Col>
          <Col xs={12} lg={3}><Card size="small"><Statistic title="Просрочено" value={totals.overdueCount} prefix={<ClockCircleFilled style={{ color: "#000" }} />} /></Card></Col>
          <Col xs={12} lg={3}><Card size="small"><Statistic title="Высокий приоритет" value={totals.highPriorityCount} prefix={<ExclamationCircleFilled style={{ color: "#000" }} />} /></Card></Col>
          <Col xs={12} lg={3}><Card size="small"><Statistic title="Прогресс" value={totals.avgProgress} suffix="%" /></Card></Col>
          <Col xs={12} lg={3}><Card size="small"><Statistic title="Часов всего" value={round(totals.actualHours)} precision={1} /></Card></Col>
</Row>

        {projects.length === 0 && !loading ? (
          <Empty description="Нет данных" style={{ marginTop: 48 }} />
        ) : (
          <>

            <Card title="Прогресс по проектам" style={{ marginTop: 16 }}>
              <Table rowKey={(r) => r.project.id} dataSource={projectRows} pagination={false} size="small"
                columns={[
                  { title: "Проект", key: "n", render: (_, r) => <span><Text strong>{r.project.code}</Text> <Text style={{ color: "#000", opacity: 0.55, fontSize: 12 }}>{r.project.name}</Text></span> },
                  { title: "Тип", key: "t", render: (_, r) => projectTypeLabel(r.project.type), width: 100 },
                   { title: "Статус", key: "s", render: (_, r) => blackTag(r.project.status === "active" ? "Активен" : r.project.status === "completed" ? "Завершён" : "—"), width: 90 },
                  { title: "Задачи", render: (_, r) => r.tasks.length, width: 60 },
                  { title: "Готово", dataIndex: "done", width: 60 },
                  { title: "Отменено", dataIndex: "cancelled", width: 70 },
                  { title: "Проср.", dataIndex: "overdue", width: 65 },
                  { title: "Выс. приор.", dataIndex: "highPriority", width: 70 },
                  { title: "Прогресс", dataIndex: "avgProgress", render: (v: number) => blackProgress(v), width: 120 },
                  { title: "Команда", dataIndex: "members", width: 60 },
                  { title: "Оценка/факт, ч", key: "h", render: (_, r) => `${round(r.estimatedHours)} / ${round(r.actualHours)}`, width: 100 },
                ]}
              />
            </Card>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24}>
                <Card title="Загрузка по людям">
                  <Table rowKey={(r) => r.user.id} dataSource={peopleRows} pagination={{ pageSize: 8, size: "small" }} size="small"
                    columns={[
                      { title: "Сотрудник", key: "u", render: (_, r) => <span><UserOutlined style={{ marginRight: 6, color: "#000" }} />{r.user.firstName ?? r.user.fullName ?? r.user.id}</span> },
                      { title: "Подразделение", key: "d", render: (_, r) => r.user.department?.name ?? "—", width: 120 },
                      { title: "Задачи", dataIndex: "tasks", width: 55 },
                      { title: "Готово", dataIndex: "done", width: 55 },
                      { title: "Проср.", dataIndex: "overdue", width: 50 },
                      { title: "Прогресс", dataIndex: "avgProgress", render: (v: number) => blackProgress(v), width: 100 },
                      { title: "Проектов", dataIndex: "projectCount", width: 60 },
                      { title: "Часы", dataIndex: "hours", render: (v: number) => round(v), width: 60 },
                    ]}
                  />
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Spin>
    </div>
  );
}
