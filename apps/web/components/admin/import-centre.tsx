"use client";

import { ChangeEvent, useState } from "react";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { parseProductCsv, type ImportRow } from "@/lib/admin/import-csv";

export function ImportCentre() {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (/\.xlsx$/i.test(file.name)) {
      setRows([]);
      setMessage("Reading Excel preview...");
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/admin/imports/preview", { method: "POST", body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Excel preview failed");
        setRows(result.rows);
        setMessage(result.invalidRows.length ? `Preview ready. Invalid rows: ${result.invalidRows.join(", ")}.` : "Preview ready.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Excel preview failed."); }
      return;
    }
    if (/\.xls$/i.test(file.name)) { setRows([]); setMessage("Only .xlsx files are supported. Export legacy .xls files as .xlsx first."); return; }
    if (!/\.csv$/i.test(file.name)) { setRows([]); setMessage("Use a CSV file. Supplier email, PDF, image, and WhatsApp inputs remain n8n-configured channels."); return; }
    setRows(parseProductCsv(await file.text()));
    setMessage("");
  }

  async function submitImport() {
    if (!rows.length) return setMessage("Choose a CSV with product name rows first.");
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName, items: rows }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Import failed");
      setMessage(`${result.importedRows} rows processed. ${result.requiresReview} require product review.`);
      setRows([]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed."); }
    finally { setSaving(false); }
  }

  return <section className="import-centre"><div className="import-centre-icon"><UploadCloud size={28} /></div><p className="eyebrow">Product import centre</p><h2>Bring supplier data into review.</h2><p className="import-centre-copy">CSV and Excel files are normalized and matched against the existing Supabase catalogue. Nothing is merged or added to stock automatically.</p><label className="import-dropzone"><FileSpreadsheet size={22} /><span>{fileName || "Choose a CSV or .xlsx supplier price list"}</span><input type="file" accept=".csv,.xlsx" onChange={selectFile} /></label>{rows.length > 0 && <div className="import-preview"><strong>{rows.length} rows ready for validation</strong>{rows.slice(0, 4).map((row, index) => <span key={`${row.name}-${index}`}>{row.name} · {row.sku || "No SKU"} · qty {row.quantity}</span>)}</div>}{message && <p className="bulk-product-message" role="status">{message}</p>}<button type="button" className="button button-primary" disabled={saving || !rows.length} onClick={submitImport}>{saving ? "Processing..." : "Validate and send to review"}</button></section>;
}
