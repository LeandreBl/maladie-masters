/**
 * The header's "Export CSV" button.
 *
 * Values are quoted and inner quotes doubled per RFC 4180, and a leading `=`,
 * `+`, `-` or `@` is prefixed with a quote: a spreadsheet would otherwise read
 * a subscriber name starting with one of those as a formula.
 */
function escapeCell(value: unknown): string {
  // Quoted like every other cell, rather than a bare gap.
  if (value === null || value === undefined) return '""';

  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => unknown;
};

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((column) => escapeCell(column.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCell(column.value(row))).join(","));
  }
  // CRLF: what Excel expects, and harmless everywhere else.
  return lines.join("\r\n");
}

/**
 * Hand the file to the browser. The BOM is what makes Excel read the accented
 * French headers as UTF-8 instead of mojibake.
 */
export function downloadCsv<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): void {
  const blob = new Blob([`﻿${toCsv(rows, columns)}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();

  // Revoked on the next tick: Safari needs the URL alive through the click.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** `maladie-users-2026-10-02.csv` */
export function csvFilename(scope: string): string {
  return `maladie-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
}
