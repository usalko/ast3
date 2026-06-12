export function statusLabel(code?: string | null, fallback?: string) {
  switch (code) {
    case "backlog":
      return "Бэклог";
    case "todo":
      return "К выполнению";
    case "in_progress":
      return "В работе";
    case "done":
      return "Готово";
    case "cancelled":
      return "Отменено";
    default:
      return fallback ?? code ?? "—";
  }
}
