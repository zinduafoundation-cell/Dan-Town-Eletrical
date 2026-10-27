"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { z } from "zod";
import { parseProductCsv, type ImportRow } from "@/lib/admin/import-csv";
import {
  matchCatalogueTaxonomy,
  parseCatalogueCsv,
  type CatalogueCsvPreview,
} from "@/lib/admin/catalogue-import";
import { MAX_IMPORT_FILE_BYTES } from "@/lib/admin/import-spreadsheet";

type Department = { id: string; name: string };
type Category = { id: string; name: string; department_id: string | null; parent_id?: string | null };
type Brand = { id: string; name: string };
type Props = { departments: Department[]; categories: Category[]; brands: Brand[] };

const importProgressSchema = z.object({
  importId: z.string().uuid(),
  fileName: z.string(),
  totalRows: z.number().int().nonnegative(),
  nextBatch: z.number().int().nonnegative(),
  processedRows: z.number().int().nonnegative(),
  matchedRows: z.number().int().nonnegative(),
  requiresReview: z.number().int().nonnegative(),
  departmentMappedRows: z.number().int().nonnegative(),
  categoryMappedRows: z.number().int().nonnegative(),
  brandMappedRows: z.number().int().nonnegative(),
  complete: z.boolean(),
});

function stableImportId(text: string) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then((digest) => {
    const bytes = new Uint8Array(digest.slice(0, 16));
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  });
}

async function postJson(url: string, body: unknown) {
  const serializedBody = JSON.stringify(body);
  if (new Blob([serializedBody]).size > 4 * 1024 * 1024) {
    throw new Error("This import exceeds the 4 MB request limit. Split it into smaller CSV files.");
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: serializedBody,
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const parsedError = z.object({ error: z.string() }).safeParse(result);
    throw new Error(parsedError.success ? parsedError.data.error : "The import request failed.");
  }
  return result;
}

export function ImportCentre({ departments, categories, brands }: Props) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [cataloguePreview, setCataloguePreview] = useState<CatalogueCsvPreview | null>(null);
  const [fileText, setFileText] = useState("");
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<z.infer<typeof importProgressSchema> | null>(null);

  const taxonomySummary = useMemo(() => {
    if (!cataloguePreview) return null;
    return cataloguePreview.rows.reduce((summary, row) => {
      const mapping = matchCatalogueTaxonomy(row, departments, categories, brands);
      summary.departments += Number(mapping.departmentMapped);
      summary.categories += Number(mapping.categoryMapped);
      summary.brands += Number(mapping.brandMapped);
      return summary;
    }, { departments: 0, categories: 0, brands: 0 });
  }, [cataloguePreview, departments, categories, brands]);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.currentTarget.value = "";
    setFileName(file.name);
    setRows([]);
    setCataloguePreview(null);
    setFileText("");
    setProgress(null);
    setMessage("");
    if (file.size === 0 || file.size > MAX_IMPORT_FILE_BYTES) {
      setMessage("CSV and Excel files must be between 1 byte and 10 MB.");
      return;
    }
    if (/\.xlsx$/i.test(file.name)) {
      setMessage("Reading Excel preview...");
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/admin/imports/preview", { method: "POST", body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Excel preview failed");
        setRows(result.rows);
        setMessage(result.invalidRows.length ? `Preview ready. Invalid rows: ${result.invalidRows.join(", ")}.` : "Preview ready.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Excel preview failed.");
      }
      return;
    }
    if (/\.xls$/i.test(file.name)) {
      setMessage("Only .xlsx files are supported. Export legacy .xls files as .xlsx first.");
      return;
    }
    if (!/\.csv$/i.test(file.name)) {
      setMessage("Use a CSV file. Supplier email, PDF, image, and WhatsApp inputs remain n8n-configured channels.");
      return;
    }
    try {
      const text = await file.text();
      const catalogue = parseCatalogueCsv(text);
      if (catalogue.supported) {
        setCataloguePreview(catalogue);
        setFileText(text);
        setMessage(catalogue.invalidRows.length
          ? `${catalogue.rows.length.toLocaleString()} catalogue rows found. Correct ${catalogue.invalidRows.length} invalid rows before staging.`
          : "Full catalogue recognized. Review field mappings and category matches before staging.");
        return;
      }
      setRows(parseProductCsv(text));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The CSV could not be read.");
    }
  }

  async function processCatalogueImport() {
    if (!cataloguePreview?.supported || !cataloguePreview.rows.length) {
      return setMessage("Choose the full Dantown catalogue CSV first.");
    }
    if (cataloguePreview.invalidRows.length) {
      return setMessage("Correct every invalid CSV row before staging this catalogue.");
    }
    setSaving(true);
    setMessage("Preparing the import review job...");
    try {
      const importId = await stableImportId(fileText);
      const started = importProgressSchema.safeParse(await postJson("/api/admin/imports", {
        action: "start",
        importId,
        fileName,
        items: cataloguePreview.rows,
      }));
      if (!started.success) throw new Error("The import service returned an invalid progress response.");
      let current = started.data;
      setProgress(current);
      const totalBatches = Math.ceil(current.totalRows / 100);
      while (current.nextBatch < totalBatches) {
        setMessage(`Staging batch ${current.nextBatch + 1} of ${totalBatches}...`);
        const next = importProgressSchema.safeParse(await postJson("/api/admin/imports", {
          action: "process",
          importId,
          batchIndex: current.nextBatch,
        }));
        if (!next.success) throw new Error("The import service returned an invalid batch response.");
        current = next.data;
        setProgress(current);
      }
      setMessage(
        `${current.processedRows.toLocaleString()} rows staged for review. `
        + `${current.matchedRows.toLocaleString()} matched existing products; `
        + `${current.requiresReview.toLocaleString()} need review. `
        + `Taxonomy mapped: ${current.departmentMappedRows.toLocaleString()} departments, `
        + `${current.categoryMappedRows.toLocaleString()} categories, and `
        + `${current.brandMappedRows.toLocaleString()} brands. `
        + `No products or inventory were changed.`,
      );
    } catch (error) {
      setMessage(error instanceof Error
        ? `${error.message} Re-select the same CSV and resume; completed batches are safe to retry.`
        : "Import failed. Re-select the same CSV to resume safely.");
    } finally {
      setSaving(false);
    }
  }

  async function submitSupplierImport() {
    if (!rows.length) return setMessage("Choose a CSV with product name rows first.");
    setSaving(true);
    setMessage("");
    try {
      const result = await postJson("/api/admin/imports", { fileName, items: rows });
      const parsed = z.object({
        importedRows: z.number().int(),
        requiresReview: z.number().int(),
      }).safeParse(result);
      if (!parsed.success) throw new Error("The import service returned an invalid response.");
      setMessage(`${parsed.data.importedRows} rows processed. ${parsed.data.requiresReview} require product review.`);
      setRows([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="import-centre" aria-labelledby="product-import-heading">
      <div className="import-centre-icon"><UploadCloud size={28} /></div>
      <p className="eyebrow">Product import centre</p>
      <h2 id="product-import-heading">Bring catalogue data into review.</h2>
      <p className="import-centre-copy">
        Preview and validate the uploaded catalogue, map it to the existing departments, categories, and brands, then stage matches for staff review. Importing never changes product records or stock automatically.
      </p>
      <label className="import-dropzone">
        <FileSpreadsheet size={22} />
        <span>{fileName || "Choose the Dantown catalogue CSV or a supplier CSV / .xlsx"}</span>
        <input type="file" accept=".csv,.xlsx" onChange={selectFile} aria-label="Choose a product catalogue file" />
      </label>

      {cataloguePreview && (
        <div className="catalogue-import-preview">
          <div className="catalogue-import-summary">
            <strong>{cataloguePreview.rows.length.toLocaleString()} catalogue rows</strong>
            <span>{cataloguePreview.invalidRows.length.toLocaleString()} invalid rows</span>
            <span>{cataloguePreview.rows.filter((row) => row.warnings.length > 0).length.toLocaleString()} rows flagged for review</span>
            {taxonomySummary && <>
              <span>Departments mapped: {taxonomySummary.departments.toLocaleString()} / {cataloguePreview.rows.length.toLocaleString()}</span>
              <span>Categories mapped: {taxonomySummary.categories.toLocaleString()} / {cataloguePreview.rows.length.toLocaleString()}</span>
              <span>Brands mapped: {taxonomySummary.brands.toLocaleString()} / {cataloguePreview.rows.length.toLocaleString()}</span>
            </>}
          </div>
          <p>
            Item code → internal code · name → product name · exact department/category/brand names → existing taxonomy · prices and description → review candidate fields · image URL → image candidate.
            Stock and POS/status columns are retained for review only; they are not applied.
          </p>
          <div className="catalogue-import-table-wrap" role="region" aria-label="Catalogue import preview" tabIndex={0}>
            <table className="catalogue-import-table">
              <thead><tr><th>CSV row</th><th>Item code</th><th>Product</th><th>Department</th><th>Category</th><th>Brand</th><th>Retail KSh</th><th>Stock (review only)</th><th>Validation</th></tr></thead>
              <tbody>
                {cataloguePreview.rows.slice(0, 10).map((row) => {
                  const mapping = matchCatalogueTaxonomy(row, departments, categories, brands);
                  return <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td><td>{row.itemCode || "—"}</td><td>{row.name || "Missing name"}</td>
                    <td>{row.department || "—"}{row.department && !mapping.departmentMapped ? " · unmapped" : ""}</td>
                    <td>{row.category || "—"}{row.category && !mapping.categoryMapped ? " · unmapped" : ""}</td>
                    <td>{row.brand || "—"}{row.brand && !mapping.brandMapped ? " · unmapped" : ""}</td>
                    <td>{row.retailPrice === null ? "Missing" : row.retailPrice.toLocaleString("en-KE")}</td>
                    <td>{row.stockQuantity ?? row.currentStock ?? row.openingStock ?? "—"}</td>
                    <td>{row.errors.length ? row.errors.join(" ") : row.warnings.length ? row.warnings.join(" ") : "Valid"}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          {cataloguePreview.invalidRows.length > 0 && (
            <ul className="catalogue-import-errors" aria-label="CSV validation errors">
              {cataloguePreview.invalidRows.slice(0, 8).map((row) => <li key={row.rowNumber}>Row {row.rowNumber}: {row.errors.join(" ")}</li>)}
            </ul>
          )}
          {progress && <p className="catalogue-import-progress" role="status">
            {progress.processedRows.toLocaleString()} / {progress.totalRows.toLocaleString()} staged · {progress.matchedRows.toLocaleString()} matched · {progress.requiresReview.toLocaleString()} flagged for review
          </p>}
          <button
            type="button"
            className="button button-primary"
            disabled={saving || !cataloguePreview.rows.length || cataloguePreview.invalidRows.length > 0 || Boolean(progress?.complete)}
            onClick={() => void processCatalogueImport()}
          >
            {saving ? "Staging review batches..." : progress?.nextBatch ? "Resume catalogue staging" : "Stage catalogue for review"}
          </button>
        </div>
      )}

      {!cataloguePreview && rows.length > 0 && (
        <div className="import-preview">
          <strong>{rows.length.toLocaleString()} supplier rows ready for validation</strong>
          {rows.slice(0, 4).map((row, index) => <span key={`${row.name}-${index}`}>{row.name} · {row.sku || "No SKU"} · qty {row.quantity}</span>)}
        </div>
      )}
      {message && <p className="bulk-product-message" role="status">{message}</p>}
      {!cataloguePreview && (
        <button type="button" className="button button-primary" disabled={saving || !rows.length} onClick={() => void submitSupplierImport()}>
          {saving ? "Processing..." : "Validate supplier rows and send to review"}
        </button>
      )}
    </section>
  );
}
