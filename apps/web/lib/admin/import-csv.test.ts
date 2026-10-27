import { describe, expect, it } from "vitest";
import { parseProductCsv } from "./import-csv";
import * as XLSX from "xlsx";
import { parseProductSpreadsheet } from "./import-spreadsheet";describe("Centre product CSV import", () => {it("normalizes supported supplier headers and numeric fields", () => {const rows = parseProductCsv("Product Name,Supplier SKU,Qty,Buying Price\nLED Panel,LGT-01,4,1250");expect(rows).toEqual([{ name : "LED Panel", sku: "LGT-01", barcode: null, quantity: 4, unitCost: 1250 }]);});it("handles quoted CSV values with embedded commas", () => {const rows = parseProductCsv('Product Name,Supplier SKU,Qty,Buying Price\n"LED, Panel","LGT-01",4,1250');expect(rows).toEqual([{ name : "LED, Panel", sku: "LGT-01", barcode: null, quantity: 4, unitCost: 1250 }]);});it("returns no rows when a product name column is missing", () => {expect(parseProductCsv("sku,quantity\nLGT-01,4")).toEqual([]);});it("clamps invalid negative stock and cost values", () => {expect(parseProductCsv("name,quantity,cost\nCable,-2,-5")[0]).toMatchObject({ name : "Cable", quantity: 0, unitCost: 0 });});it("previews xlsx rows and reports rows without product names", () => {const workbook = XLSX.utils.book_new();const sheet = XLSX.utils.aoa_to_sheet([["Product Name", "Code", "Qty", "Cost"], ["LED Panel", "LGT-01", 4, 1250], ["", "BAD-01", 2, 10]]);XLSX.utils.book_append_sheet(workbook, sheet, "Products");const buffer = XLSX.write(workbook, { type : "array", bookType: "xlsx" });expect(parseProductSpreadsheet(buffer)).toMatchObject({rows : [{ name: "LED Panel", sku: "LGT-01", quantity: 4, unitCost: 1250 }],invalidRows : [3]});});
});

import { findDuplicateCatalogueIdentifiers, matchCatalogueTaxonomy, parseCatalogueCsv } from "./catalogue-import";

describe("Dantown full catalogue CSV import", () => {
  const headers = "Dantown Item Code,Product Name,Brand,Department,Category,Product Description,Manufacturer Code,Barcode,Retail Price (KES),Wholesale Price (KES),Dealer Price (KES),Cost Price (KES),Unit,Stock Quantity,Product Image URL,Image Search Link,Manufacturer / Supplier Search,Brand Assignment Note,Product Status,POS Enabled,Stock Quantity (Opening),Stock Quantity (Current)";

  it("maps catalogue fields while treating stock values as review-only values", () => {
    const preview = parseCatalogueCsv(`${headers}\nDT-001,"LED, panel",Acme,Lighting,Decorative Lighting,Desc,MP-1,123,8500,7000,,3700,piece,50,https://example.com/image.jpg,https://example.com/search,https://example.com/supplier,Verify,Active,Yes,45,50`);
    expect(preview.supported).toBe(true);
    expect(preview.invalidRows).toEqual([]);
    expect(preview.rows[0]).toMatchObject({
      rowNumber: 2,
      itemCode: "DT-001",
      name: "LED, panel",
      brand: "Acme",
      department: "Lighting",
      category: "Decorative Lighting",
      manufacturerCode: "MP-1",
      retailPrice: 8500,
      wholesalePrice: 7000,
      dealerPrice: null,
      costPrice: 3700,
      stockQuantity: 50,
      openingStock: 45,
      currentStock: 50,
      posEnabled: true,
    });
  });

  it("flags missing prices and duplicate identifiers for review while rejecting rows without names", () => {
    const invalidRetailRow = ["DT-001", "Duplicate panel", "Acme", "Lighting", "Decorative Lighting", "", "", "", "nope", "", "", "", "", "", "", "", "", "", "", "", "", ""].join(",");
    const preview = parseCatalogueCsv([
      headers,
      "DT-001,Panel,Acme,Lighting,Decorative Lighting,,,,8500,,,,piece,2,,,,,Active,Yes,,",
      invalidRetailRow,
      ",,Acme,Lighting,Decorative Lighting,,,,,,,,,,,,,,,",
    ].join("\n"));
    expect(preview.invalidRows.map((row) => row.rowNumber)).toEqual([4]);
    expect(preview.rows[0].warnings.some((warning) => warning.includes("Duplicate Dantown item code"))).toBe(true);
    expect(preview.rows[1].warnings.some((warning) => warning.includes("Retail price value"))).toBe(true);
    expect(preview.rows[2].errors).toContain("Product name is required.");
  });

  it("flags fractional stock for review and rejects malformed quoted CSV", () => {
    const fractionalRow = ["DT-001", "Panel", "", "", "", "", "", "", "100", "", "", "", "", "1.5", "", "", "", "", "", "", "", ""].join(",");
    const fractional = parseCatalogueCsv(`${headers}\n${fractionalRow}`);
    expect(fractional.rows[0].warnings).toContain('Stock quantity value "1.5" is not a non-negative whole number and requires review.');
    expect(() => parseCatalogueCsv(`${headers}\nDT-001,"Unclosed,,,,,,,,100`)).toThrow("unclosed quoted field");
  });

  it("finds duplicate identifiers when validating server-submitted rows", () => {
    const firstRow = ["DT-001", "Panel", "", "", "", "", "", "", "8500", "", "", "", "", "123", "", "", "", "", "", "", "", ""].join(",");
    const secondRow = ["DT-001", "Another panel", "", "", "", "", "", "", "8500", "", "", "", "", "123", "", "", "", "", "", "", "", ""].join(",");
    const preview = parseCatalogueCsv([
      headers,
      firstRow,
      secondRow,
    ].join("\n"));
    expect(findDuplicateCatalogueIdentifiers(preview.rows).size).toBe(2);
  });

  it("maps departments, categories, and brands by unique normalized exact names", () => {
    const taxonomy = matchCatalogueTaxonomy(
      { department: " lighting ", category: "decorative LIGHTING", brand: "ACME" },
      [{ id: "dep-light", name: "Lighting" }],
      [{ id: "cat-light", name: "Decorative Lighting", department_id: "dep-light" }],
      [{ id: "brand-acme", name: "Acme" }],
    );
    expect(taxonomy).toMatchObject({
      departmentId: "dep-light",
      categoryId: "cat-light",
      brandId: "brand-acme",
      departmentMapped: true,
      categoryMapped: true,
      brandMapped: true,
    });
    expect(matchCatalogueTaxonomy(
      { department: "Solar", category: "Decorative Lighting", brand: "Unknown" },
      [{ id: "dep-solar", name: "Solar" }],
      [{ id: "cat-light", name: "Decorative Lighting", department_id: "dep-light" }],
      [],
    )).toMatchObject({ categoryMapped: false, categoryId: null, brandMapped: false });
  });

  it("maps duplicate category names using the department and inherited parent department", () => {
    const taxonomy = matchCatalogueTaxonomy(
      { department: "Solar", category: "Kits", brand: null },
      [{ id: "dep-solar", name: "Solar" }, { id: "dep-lighting", name: "Lighting" }],
      [
        { id: "solar-root", name: "Solar", department_id: "dep-solar", parent_id: null },
        { id: "solar-kits", name: "Kits", department_id: null, parent_id: "solar-root" },
        { id: "lighting-kits", name: "Kits", department_id: "dep-lighting", parent_id: null },
      ],
      [],
    );
    expect(taxonomy).toMatchObject({ categoryId: "solar-kits", categoryMapped: true });
  });
});
