export function escapeCsvCell(
  value: string | number | boolean | null | undefined
) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
) {
  const csv = [
    headers.map(entry => escapeCsvCell(entry)).join(","),
    ...rows.map(row => row.map(entry => escapeCsvCell(entry)).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
