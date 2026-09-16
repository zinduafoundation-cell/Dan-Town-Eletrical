export type ImportRow = { name: string; sku: string | null; barcode: string | null; quantity: number; unitCost: number };

export function mapProductValues(values: unknown[], headers: string[]): ImportRow | null {
  const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());
  const index = (names: string[]) => names.map((name) => normalizedHeaders.indexOf(name)).find((value) => value >= 0) ?? -1;
  const nameIndex = index(["name", "product", "product name"]);
  const skuIndex = index(["sku", "supplier sku", "code"]);
  const barcodeIndex = index(["barcode", "ean"]);
  const quantityIndex = index(["quantity", "qty", "stock"]);
  const costIndex = index(["unit cost", "cost", "buying price"]);
  if (nameIndex < 0) return null;

  const name = String(values[nameIndex] ?? "").trim();
  if (!name) return null;
  const quantity = Number(values[quantityIndex] ?? 0);
  const unitCost = Number(values[costIndex] ?? 0);
  return {
    name,
    sku: skuIndex >= 0 ? String(values[skuIndex] ?? "").trim() || null : null,
    barcode: barcodeIndex >= 0 ? String(values[barcodeIndex] ?? "").trim() || null : null,
    quantity: Number.isFinite(quantity) ? Math.max(0, quantity) : 0,
    unitCost: Number.isFinite(unitCost) ? Math.max(0, unitCost) : 0
  };
}

export function parseProductCsv(text: string): ImportRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      record.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      record.push(field);
      if (record.some((value) => value.trim())) records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  record.push(field);
  if (record.some((value) => value.trim())) records.push(record);
  if (records.length < 2) return [];
  return records.slice(1).map((values) => mapProductValues(values, records[0])).filter((row): row is ImportRow => row !== null);
}
