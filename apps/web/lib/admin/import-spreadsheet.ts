import { readSheet } from "read-excel-file/universal";
import { mapProductValues, type ImportRow } from "./import-csv";

export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

export type SpreadsheetPreview = {
  headers: string[];
  rows: ImportRow[];
  invalidRows: number[];
};

export async function parseProductSpreadsheet(buffer: ArrayBuffer): Promise<SpreadsheetPreview> {
  const values = (await readSheet(buffer)).map((row) =>
    row.map((value) => value ?? ""),
  );
  const headers = (values[0] ?? []).map((value) => String(value).trim());

  if (!headers.some(Boolean)) return { headers, rows: [], invalidRows: [] };

  const rows: ImportRow[] = [];
  const invalidRows: number[] = [];

  values.slice(1).forEach((values, index) => {
    if (values.every((value) => String(value).trim() === "")) return;

    const row = mapProductValues(values, headers);
    if (!row) invalidRows.push(index + 2);
    else rows.push(row);
  });

  return { headers, rows, invalidRows };
}