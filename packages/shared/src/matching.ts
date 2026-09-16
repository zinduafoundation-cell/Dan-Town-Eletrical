import type { ProductMatchCandidate } from "./automation";

export type MatchableProduct = { id: string; name: string; sku?: string | null; barcode?: string | null; brandName?: string | null };
export type MatchInput = { name: string; sku?: string; barcode?: string; brandName?: string };

export function normalizeProductName(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function matchProduct(input: MatchInput, products: MatchableProduct[]): ProductMatchCandidate {
  const normalizedInput = normalizeProductName(input.name);
  const exactSku = products.find((product) => input.sku && product.sku?.toLowerCase() === input.sku.toLowerCase());
  if (exactSku) return { productId: exactSku.id, status: "MATCHED", confidence: 1, reasons: ["Exact SKU match"] };
  const exactBarcode = products.find((product) => input.barcode && product.barcode === input.barcode);
  if (exactBarcode) return { productId: exactBarcode.id, status: "MATCHED", confidence: 1, reasons: ["Exact barcode match"] };
  const exactName = products.find((product) => normalizeProductName(product.name) === normalizedInput && (!input.brandName || normalizeProductName(product.brandName ?? "") === normalizeProductName(input.brandName)));
  if (exactName) return { productId: exactName.id, status: "MATCHED", confidence: 0.98, reasons: ["Normalized product name and brand match"] };
  const possible = products.find((product) => {
    const namesMatch = normalizeProductName(product.name).includes(normalizedInput) || normalizedInput.includes(normalizeProductName(product.name));
    const brandsMatch = !input.brandName || normalizeProductName(product.brandName ?? "") === normalizeProductName(input.brandName);
    return namesMatch && brandsMatch;
  });
  if (possible) return { productId: possible.id, status: "POSSIBLE_MATCH", confidence: 0.65, reasons: ["Partial normalized name match; human review required"] };
  return { status: "NEW_PRODUCT", confidence: 0.1, reasons: ["No safe catalog match found"] };
}
