// Lightweight CSV export utility for admin data tables.
// No dependencies — builds an RFC-4180-ish CSV and triggers a browser download.
// A UTF-8 BOM is prepended so Excel renders accented French characters correctly.

export type CsvColumn<TData> = {
  /** Column header text in the exported file. */
  header: string;
  /** Extract the cell value for a row. Return string | number | null | undefined. */
  value: (row: TData) => string | number | null | undefined;
};

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Quote if the cell contains a comma, quote, newline, or leading/trailing space.
  if (/[",\n\r]/.test(str) || /^\s|\s$/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv<TData>(
  rows: TData[],
  columns: CsvColumn<TData>[]
): string {
  const headerLine = columns.map(c => escapeCsvCell(c.header)).join(",");
  const lines = rows.map(row =>
    columns.map(c => escapeCsvCell(c.value(row))).join(",")
  );
  return [headerLine, ...lines].join("\r\n");
}

function timestampedName(base: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate()
  )}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const safeBase = base.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
  return `${safeBase || "export"}-${stamp}.csv`;
}

/**
 * Build a CSV from rows + columns and trigger a download in the browser.
 * @param filenameBase base name (timestamp + .csv appended automatically)
 */
export function downloadCsv<TData>(
  rows: TData[],
  columns: CsvColumn<TData>[],
  filenameBase: string
): void {
  const csv = buildCsv(rows, columns);
  // Prepend UTF-8 BOM for Excel compatibility with accented characters.
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = timestampedName(filenameBase);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Release the object URL on the next tick.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
