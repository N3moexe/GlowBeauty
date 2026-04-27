export function formatCFA(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(value || 0))} CFA`;
}

export function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "Tracking not enabled";
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

export function toDateLabel(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR");
}

export function toDateInputValue(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
