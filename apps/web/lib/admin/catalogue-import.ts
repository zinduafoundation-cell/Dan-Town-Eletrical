export type CatalogueImportRow = {
  rowNumber: number;
  itemCode: string | null;
  name: string;
  brand: string | null;
  department: string | null;
  category: string | null;
  description: string | null;
  manufacturerCode: string | null;
  barcode: string | null;
  retailPrice: number | null;
  wholesalePrice: number | null;
  dealerPrice: number | null;
  costPrice: number | null;
  unit: string | null;
  stockQuantity: number | null;
  imageUrl: string | null;
  imageSearchLink: string | null;
  supplierSearchLink: string | null;
  brandAssignmentNote: string | null;
  declaredStatus: string | null;
  posEnabled: boolean | null;
  openingStock: number | null;
  currentStock: number | null;
  errors: string[];
  warnings: string[];
};

export type CatalogueCsvPreview = {
  supported: boolean;
  headers: string[];
  rows: CatalogueImportRow[];
  invalidRows: Array<{ rowNumber: number; errors: string[] }>;
};

type CsvRecord = { values: string[]; rowNumber: number };

function parseCsvRecords(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let values: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  const finishRecord = () => {
    values.push(field);
    if (values.some((value) => value.trim())) records.push({ values, rowNumber: recordLine });
    values = [];
    field = "";
  };

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
      values.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      finishRecord();
      line += 1;
      recordLine = line;
    } else {
      field += character;
      if ((character === "\n" || character === "\r") && quoted) {
        if (character === "\r" && text[index + 1] === "\n") {
          field += "\n";
          index += 1;
        }
        line += 1;
      }
    }
  }

  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  finishRecord();
  return records;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizedName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function normalizeCatalogueLabel(value: string) {
  return normalizedName(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function parseOptionalNumber(value: string | undefined, fieldName: string, warnings: string[]) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const number = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(number) || number < 0) {
    warnings.push(`${fieldName} value "${trimmed.slice(0, 40)}" is invalid and requires human review.`);
    return null;
  }
  return number;
}

function parseOptionalStock(value: string | undefined, fieldName: string, warnings: string[]) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const number = Number(trimmed.replace(/,/g, ""));
  if (!Number.isSafeInteger(number) || number < 0) {
    warnings.push(`${fieldName} value "${trimmed.slice(0, 40)}" is not a non-negative whole number and requires review.`);
    return null;
  }
  return number;
}

function parsePosEnabled(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (["yes", "true", "enabled", "active", "1"].includes(normalized)) return true;
  if (["no", "false", "disabled", "inactive", "0"].includes(normalized)) return false;
  return null;
}

function optionalUrl(value: string | undefined, label: string, warnings: string[]) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.toString();
  } catch {
    // An invalid source URL is retained as a review warning, not treated as an image.
  }
  warnings.push(`${label} is not a valid HTTP(S) URL and was not accepted.`);
  return null;
}

export function parseCatalogueCsv(text: string): CatalogueCsvPreview {
  const records = parseCsvRecords(text);
  if (records.length < 2) return { supported: false, headers: [], rows: [], invalidRows: [] };
  const headers = records[0].values.map((header) => header.trim().replace(/^\uFEFF/, ""));
  const normalizedHeaders = headers.map(normalizeHeader);
  const column = (aliases: string[]) => {
    const names = aliases.map(normalizeHeader);
    return normalizedHeaders.findIndex((header) => names.includes(header));
  };
  const nameColumn = column(["Product Name", "Name"]);
  const departmentColumn = column(["Department"]);
  const categoryColumn = column(["Category"]);
  const supported = nameColumn >= 0 && departmentColumn >= 0 && categoryColumn >= 0;
  if (!supported) return { supported: false, headers, rows: [], invalidRows: [] };

  const get = (record: CsvRecord, aliases: string[]) => {
    const index = column(aliases);
    return index >= 0 ? record.values[index]?.trim() ?? "" : "";
  };

  const rows = records.slice(1).map((record): CatalogueImportRow => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const name = get(record, ["Product Name", "Name"]);
    if (!name) errors.push("Product name is required.");
    if (name.length > 300) errors.push("Product name must be 300 characters or fewer.");
    const retailPrice = parseOptionalNumber(get(record, ["Retail Price (KES)", "Retail Price", "Selling Price"]), "Retail price", warnings);
    if (retailPrice === null && !get(record, ["Retail Price (KES)", "Retail Price", "Selling Price"])) {
      warnings.push("Retail price is missing and requires human review.");
    }
    const posValue = get(record, ["POS Enabled"]);
    const posEnabled = parsePosEnabled(posValue);
    if (posValue && posEnabled === null) warnings.push("POS Enabled value was not recognized and needs review.");
    const itemCode = get(record, ["Dantown Item Code", "Item Code", "Internal Code"]);
    if (!itemCode) warnings.push("Dantown item code is missing; duplicate matching will rely on other fields.");
    if (itemCode.length > 120) errors.push("Dantown item code must be 120 characters or fewer.");
    const imageSearchLink = optionalUrl(get(record, ["Image Search Link"]), "Image search link", warnings);
    const supplierSearchLink = optionalUrl(get(record, ["Manufacturer / Supplier Search", "Supplier Search"]), "Supplier search link", warnings);

    return {
      rowNumber: record.rowNumber,
      itemCode: itemCode || null,
      name,
      brand: get(record, ["Brand"]) || null,
      department: get(record, ["Department"]) || null,
      category: get(record, ["Category"]) || null,
      description: get(record, ["Product Description", "Description"]) || null,
      manufacturerCode: get(record, ["Manufacturer Code", "Manufacturer Part Number"]) || null,
      barcode: get(record, ["Barcode", "EAN"]) || null,
      retailPrice,
      wholesalePrice: parseOptionalNumber(get(record, ["Wholesale Price (KES)", "Wholesale Price"]), "Wholesale price", warnings),
      dealerPrice: parseOptionalNumber(get(record, ["Dealer Price (KES)", "Dealer Price"]), "Dealer price", warnings),
      costPrice: parseOptionalNumber(get(record, ["Cost Price (KES)", "Cost Price", "Unit Cost"]), "Cost price", warnings),
      unit: get(record, ["Unit", "Unit of Measure"]) || null,
      stockQuantity: parseOptionalStock(get(record, ["Stock Quantity", "Quantity", "Qty"]), "Stock quantity", warnings),
      imageUrl: optionalUrl(get(record, ["Product Image URL", "Image URL"]), "Product image URL", warnings),
      imageSearchLink,
      supplierSearchLink,
      brandAssignmentNote: get(record, ["Brand Assignment Note"]) || null,
      declaredStatus: get(record, ["Product Status", "Status"]) || null,
      posEnabled,
      openingStock: parseOptionalStock(get(record, ["Stock Quantity (Opening)", "Opening Stock"]), "Opening stock", warnings),
      currentStock: parseOptionalStock(get(record, ["Stock Quantity (Current)", "Current Stock"]), "Current stock", warnings),
      errors,
      warnings,
    };
  });

  const duplicateRows = findDuplicateCatalogueIdentifiers(rows);
  for (const row of rows) row.warnings.push(...(duplicateRows.get(row.rowNumber) ?? []));
  const invalidRows = rows
    .filter((row) => row.errors.length > 0)
    .map(({ rowNumber, errors }) => ({ rowNumber, errors }));
  return { supported: true, headers, rows, invalidRows };
}

export function findDuplicateCatalogueIdentifiers(rows: CatalogueImportRow[]) {
  const duplicateRows = new Map<number, string[]>();
  for (const [field, label] of [["itemCode", "Dantown item code"], ["barcode", "barcode"]] as const) {
    const seen = new Map<string, number>();
    for (const row of rows) {
      const value = row[field]?.trim();
      if (!value) continue;
      const key = value.toLocaleLowerCase();
      const firstRow = seen.get(key);
      if (firstRow !== undefined) {
        for (const rowNumber of [firstRow, row.rowNumber]) {
          const issues = duplicateRows.get(rowNumber) ?? [];
          issues.push(`Duplicate ${label} also appears on row ${rowNumber === firstRow ? row.rowNumber : firstRow}.`);
          duplicateRows.set(rowNumber, issues);
        }
      } else {
        seen.set(key, row.rowNumber);
      }
    }
  }
  return duplicateRows;
}

export function matchCatalogueTaxonomy(
  row: Pick<CatalogueImportRow, "department" | "category" | "brand">,
  departments: Array<{ id: string; name: string }>,
  categories: Array<{ id: string; name: string; department_id: string | null; parent_id?: string | null }>,
  brands: Array<{ id: string; name: string }>,
) {
  const exact = <T extends { id: string; name: string }>(name: string | null, values: T[]) => {
    if (!name) return null;
    const matches = values.filter((value) => normalizeCatalogueLabel(value.name) === normalizeCatalogueLabel(name));
    return matches.length === 1 ? matches[0] : null;
  };
  const department = exact(row.department, departments);
  const brand = exact(row.brand, brands);
  const categoryMatches = row.category
    ? categories.filter((value) => normalizeCatalogueLabel(value.name) === normalizeCatalogueLabel(row.category ?? ""))
    : [];
  const categoryById = new Map(categories.map((value) => [value.id, value]));
  const getDepartmentId = (categoryId: string) => {
    const visited = new Set<string>();
    let current = categoryById.get(categoryId);
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      if (current.department_id) return current.department_id;
      current = current.parent_id ? categoryById.get(current.parent_id) : undefined;
    }
    return null;
  };
  const departmentCandidates = department
    ? categoryMatches.filter((value) => getDepartmentId(value.id) === department.id)
    : row.department ? [] : categoryMatches;
  const category = departmentCandidates.length === 1 ? departmentCandidates[0] : null;
  const categoryMapped = Boolean(category);
  return {
    departmentId: department?.id ?? null,
    categoryId: categoryMapped ? category?.id ?? null : null,
    brandId: brand?.id ?? null,
    departmentMapped: Boolean(department),
    categoryMapped,
    brandMapped: Boolean(brand),
  };
}
