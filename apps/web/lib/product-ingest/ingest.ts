import { z } from "zod";

export type ProductIngestSource = "MANUAL" | "CSV" | "EXCEL" | "WHATSAPP" | "EMAIL" | "IMAGE" | "PDF" | "N8N";
export type ProductAction = "CREATE_NEW" | "UPDATE_EXISTING" | "REVIEW_REQUIRED" | "REJECTED";

export type ProductSubmission = {
  source: ProductIngestSource;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  brand?: string | null;
  category?: string | null;
  quantity?: number | null;
  costPrice?: number | null;
  sellingPrice?: number | null;
  wholesalePrice?: number | null;
  supplier?: string | null;
  description?: string | null;
  imageUrl?: string | null;
};

export const ProductSubmissionSchema = z.object({
  source: z.enum(["MANUAL", "CSV", "EXCEL", "WHATSAPP", "EMAIL", "IMAGE", "PDF", "N8N"]),
  name: z.string().trim().min(1, "Product name is required."),
  sku: z.string().trim().optional().nullable(),
  barcode: z.string().trim().optional().nullable(),
  brand: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  quantity: z.number().finite().min(0, "Quantity cannot be negative.").optional().nullable(),
  costPrice: z.number().finite().min(0, "Cost price must be zero or greater.").optional().nullable(),
  sellingPrice: z.number().finite().min(0, "Selling price must be zero or greater.").optional().nullable(),
  wholesalePrice: z.number().finite().min(0, "Wholesale price must be zero or greater.").optional().nullable(),
  supplier: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  imageUrl: z.string().url().optional().nullable()
}).strict();

export function normalizeProductName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function validateProductSubmission(input: Partial<ProductSubmission>) {
  const result = ProductSubmissionSchema.safeParse(input);
  if (!result.success) {
    return {
      ok: false as const,
      errors: result.error.issues.map((issue) => issue.message).filter(Boolean),
      normalized: null
    };
  }

  const normalized = {
    ...result.data,
    name: result.data.name.trim(),
    brand: result.data.brand?.trim() ?? null,
    category: result.data.category?.trim() ?? null,
    sku: result.data.sku?.trim() || null,
    barcode: result.data.barcode?.trim() || null,
    supplier: result.data.supplier?.trim() || null,
    description: result.data.description?.trim() || null,
    imageUrl: result.data.imageUrl ?? null
  };

  const errors: string[] = [];
  if (!normalized.name) errors.push("Product name is required.");
  if (!normalized.source) errors.push("Product source is required.");
  if (normalized.sellingPrice == null && normalized.costPrice == null) {
    errors.push("At least one price must be supplied.");
  }
  if (normalized.sellingPrice != null && normalized.sellingPrice < 0) {
    errors.push("Selling price must be zero or greater.");
  }
  if (normalized.costPrice != null && normalized.costPrice < 0) {
    errors.push("Cost price must be zero or greater.");
  }
  if (normalized.quantity != null && normalized.quantity < 0) {
    errors.push("Quantity cannot be negative.");
  }
  if (normalized.source === "WHATSAPP" && (!normalized.name || !normalized.category)) {
    errors.push("WhatsApp product imports require a product name and category.");
  }

  return errors.length ? { ok: false as const, errors, normalized } : { ok: true as const, errors: [], normalized };
}

export function classifyProductAction(candidate: Partial<ProductSubmission> | null, existing: { sku?: string | null; name?: string | null; brand?: string | null } | null) {
  if (!candidate) return "REVIEW_REQUIRED";

  const candidateSku = candidate.sku?.trim();
  const existingSku = existing?.sku?.trim();
  if (candidateSku && existingSku && candidateSku === existingSku) return "UPDATE_EXISTING";

  if (!candidate.name?.trim()) return "REVIEW_REQUIRED";

  const candidateName = normalizeProductName(candidate.name ?? "");
  const existingName = normalizeProductName(existing?.name ?? "");
  const candidateBrand = (candidate.brand ?? "").trim().toLowerCase();
  const existingBrand = (existing?.brand ?? "").trim().toLowerCase();

  if (candidateName && existingName && candidateName === existingName) {
    if (!candidateBrand || !existingBrand || candidateBrand === existingBrand) return "UPDATE_EXISTING";
    return "REVIEW_REQUIRED";
  }

  if (candidateName && existingName && candidateName.includes(existingName.slice(0, Math.min(6, existingName.length)))) return "REVIEW_REQUIRED";
  if (existing) return "REVIEW_REQUIRED";
  return "CREATE_NEW";
}

export function buildProductReviewSummary(payload: ProductSubmission) {
  return {
    source: payload.source,
    name: payload.name,
    sku: payload.sku ?? "UNKNOWN",
    brand: payload.brand ?? "UNKNOWN",
    category: payload.category ?? "UNCATEGORIZED",
    quantity: payload.quantity ?? 0,
    costPrice: payload.costPrice ?? 0,
    sellingPrice: payload.sellingPrice ?? 0,
    status: "PENDING",
    confidence: payload.source === "N8N" ? 0.83 : 0.72
  };
}
