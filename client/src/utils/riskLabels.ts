export function riskLabel(level?: number | null) {
  switch (level) {
    case 0:
      return "Низкий";
    case 1:
      return "Средний";
    case 2:
      return "Высокий";
    case 3:
      return "Критический";
    default:
      return "—";
  }
}

export function riskColor(level?: number | null) {
  switch (level) {
    case 0:
      return "green";
    case 1:
      return "blue";
    case 2:
      return "orange";
    case 3:
      return "red";
    default:
      return "default";
  }
}