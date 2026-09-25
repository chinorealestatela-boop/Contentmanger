// Shared RFC4180-ish CSV tokenizer used by every CSV-import path in the
// app (inventory, sold-customer/down-payment import, …). Handles quoted
// fields (with embedded commas, newlines, and "" as an escaped quote) and
// bare unquoted fields — a naive split(",") breaks the moment a
// description/notes column contains a comma, which real dealer exports
// always do.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  // Normalize line endings so \r\n inside/outside quotes behaves the same.
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // Last field/row (files don't always end with a trailing newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === "")); // drop fully-blank lines
}

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** RFC4180 field escaping for the CSV writers below (export paths). Only
 * quotes when needed, matching what parseCsv above expects to read back. */
function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map((f) => csvField(f == null ? "" : String(f))).join(",");
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  // Leading BOM so Excel opens UTF-8 CSVs (names/emails) without mangling
  // characters — plain files without it get misread as Latin-1 in Excel.
  return "﻿" + rows.map(toCsvRow).join("\r\n") + "\r\n";
}
