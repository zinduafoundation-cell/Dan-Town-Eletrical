import { NextResponse } from "next/server";
import { requireAuthorizedPermission } from "../../../../../lib/auth/server";
import { MAX_IMPORT_FILE_BYTES, parseProductSpreadsheet } from "../../../../../lib/admin/import-spreadsheet";

const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream"
]);

export async function POST(request: Request) {
  try {
    await requireAuthorizedPermission("automation.manage");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an Excel file." }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".xlsx") || !XLSX_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Only .xlsx files are supported." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_IMPORT_FILE_BYTES) {
      return NextResponse.json({ error: "Excel files must be between 1 byte and 10 MB." }, { status: 400 });
    }
    return NextResponse.json({ fileName: file.name, ...parseProductSpreadsheet(await file.arrayBuffer()) });
  } catch (error) {
    console.error("EXCEL IMPORT PREVIEW ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to preview Excel file." }, { status: 500 });
  }
}