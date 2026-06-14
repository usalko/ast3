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
      return "default";
    case 1:
      return "default";
    case 2:
      return "default";
    case 3:
      return "default";
    default:
      return "default";
  }
}
