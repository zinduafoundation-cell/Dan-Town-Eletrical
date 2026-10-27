import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAutomationJob, saveProductMatch } from "@dantown/database";
import { matchProduct, normalizeProductName } from "@dantown/shared";
import { getPermissionGuard } from "../../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { findDuplicateCatalogueIdentifiers, matchCatalogueTaxonomy } from "../../../../lib/admin/catalogue-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supplierImportSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  items: z.array(z.object({
    name: z.string().trim().min(1).max(300),
    sku: z.string().trim().max(120).nullable(),
    barcode: z.string().trim().max(64).nullable(),
    quantity: z.number().int().nonnegative(),
    unitCost: z.number().finite().nonnegative(),
  })).min(1).max(1000),
});

const catalogueUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}).nullable();

const catalogueRowSchema = z.object({
  rowNumber: z.number().int().min(2).max(100_000),
  itemCode: z.string().trim().max(120).nullable().default(null),
  name: z.string().trim().min(1).max(300),
  brand: z.string().trim().max(160).nullable().default(null),
  department: z.string().trim().max(160).nullable().default(null),
  category: z.string().trim().max(160).nullable().default(null),
  description: z.string().max(10_000).nullable().default(null),
  manufacturerCode: z.string().trim().max(160).nullable().default(null),
  barcode: z.string().trim().max(64).nullable().default(null),
  retailPrice: z.number().finite().nonnegative().nullable().default(null),
  wholesalePrice: z.number().finite().nonnegative().nullable().default(null),
  dealerPrice: z.number().finite().nonnegative().nullable().default(null),
  costPrice: z.number().finite().nonnegative().nullable().default(null),
  unit: z.string().trim().max(40).nullable().default(null),
  stockQuantity: z.number().int().nonnegative().nullable().default(null),
  imageUrl: catalogueUrlSchema.default(null),
  imageSearchLink: catalogueUrlSchema.default(null),
  supplierSearchLink: catalogueUrlSchema.default(null),
  brandAssignmentNote: z.string().max(1000).nullable().default(null),
  declaredStatus: z.string().trim().max(40).nullable().default(null),
  posEnabled: z.boolean().nullable().default(null),
  openingStock: z.number().int().nonnegative().nullable().default(null),
  currentStock: z.number().int().nonnegative().nullable().default(null),
  errors: z.array(z.string().max(200)).max(20),
  warnings: z.array(z.string().max(200)).max(20),
});

const startCatalogueImportSchema = z.object({
  action: z.literal("start"),
  importId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(200),
  items: z.array(catalogueRowSchema).min(1).max(3000),
});

const processCatalogueImportSchema = z.object({
  action: z.literal("process"),
  importId: z.string().uuid(),
  batchIndex: z.number().int().nonnegative(),
});

const catalogueImportPayloadSchema = z.object({
  type: z.literal("DANTOWN_CATALOGUE_IMPORT"),
  version: z.literal(1),
  importId: z.string().uuid(),
  fileName: z.string(),
  uploadedBy: z.string(),
  items: z.array(catalogueRowSchema),
  nextBatch: z.number().int().nonnegative(),
  processedRows: z.number().int().nonnegative(),
  matchedRows: z.number().int().nonnegative(),
  requiresReview: z.number().int().nonnegative(),
  departmentMappedRows: z.number().int().nonnegative(),
  categoryMappedRows: z.number().int().nonnegative(),
  brandMappedRows: z.number().int().nonnegative(),
});

const IMPORT_BATCH_SIZE = 100;
const MAX_IMPORT_REQUEST_BYTES = 4 * 1024 * 1024;

class ImportPayloadTooLargeError extends Error {}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMPORT_REQUEST_BYTES) {
    throw new ImportPayloadTooLargeError("Import request exceeds the 4 MB limit.");
  }
  if (!request.body) throw new Error("Import request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_IMPORT_REQUEST_BYTES) {
      await reader.cancel();
      throw new ImportPayloadTooLargeError("Import request exceeds the 4 MB limit.");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function catalogueProgress(
  payload: z.infer<typeof catalogueImportPayloadSchema>,
  totalBatches: number,
  complete: boolean,
) {
  return {
    importId: payload.importId,
    fileName: payload.fileName,
    totalRows: payload.items.length,
    totalBatches,
    nextBatch: payload.nextBatch,
    processedRows: payload.processedRows,
    matchedRows: payload.matchedRows,
    requiresReview: payload.requiresReview,
    departmentMappedRows: payload.departmentMappedRows,
    categoryMappedRows: payload.categoryMappedRows,
    brandMappedRows: payload.brandMappedRows,
    complete,
  };
}

function stableMatchId(importId: string, rowNumber: number) {
  const bytes = createHash("sha1").update(`${importId}:${rowNumber}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function loadCatalogueProducts(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const pageSize = 1000;
  const products: Array<{ id: string; name: string; sku: string | null; barcode: string | null; internal_code: string | null; brand_id: string | null }> = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,sku,barcode,internal_code,brand_id")
      .eq("is_active", true)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    products.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return products;
}

async function startCatalogueImport(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: z.infer<typeof startCatalogueImportSchema>,
  userId: string,
) {
  if (input.items.some((item) => item.errors.length > 0)) {
    return NextResponse.json({ error: "Correct invalid CSV rows before staging this catalogue." }, { status: 400 });
  }

  const payload = {
    type: "DANTOWN_CATALOGUE_IMPORT" as const,
    version: 1 as const,
    importId: input.importId,
    fileName: input.fileName,
    uploadedBy: userId,
    items: input.items,
    nextBatch: 0,
    processedRows: 0,
    matchedRows: 0,
    requiresReview: 0,
    departmentMappedRows: 0,
    categoryMappedRows: 0,
    brandMappedRows: 0,
  };

  const { data: existingJob, error: existingError } = await supabase
    .from("automation_jobs")
    .select("id,payload")
    .eq("id", input.importId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existingJob) {
    const existing = catalogueImportPayloadSchema.safeParse(existingJob.payload);
    if (!existing.success || existing.data.uploadedBy !== userId) {
      return NextResponse.json({ error: "This import identifier is already in use by another job." }, { status: 409 });
    }
    if (JSON.stringify(existing.data.items) !== JSON.stringify(input.items)) {
      return NextResponse.json({ error: "The selected file differs from the saved import. Use a new upload." }, { status: 409 });
    }
    const totalBatches = Math.ceil(existing.data.items.length / IMPORT_BATCH_SIZE);
    return NextResponse.json(catalogueProgress(existing.data, totalBatches, existing.data.nextBatch >= totalBatches));
  }

  const { data: job, error } = await supabase.from("automation_jobs").insert({
    id: input.importId,
    workflow_name: "PRODUCT_INGESTION",
    status: "RECEIVED",
    source: "CENTRE_CATALOGUE_CSV",
    source_reference: input.fileName,
    payload,
  }).select("id").single();
  if (error || !job) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "This import was started concurrently. Re-upload the same file to resume it." }, { status: 409 });
    }
    throw error ?? new Error("Unable to create the catalogue import review job.");
  }

  return NextResponse.json(catalogueProgress(payload, Math.ceil(input.items.length / IMPORT_BATCH_SIZE), false), { status: 202 });
}

async function processCatalogueImport(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: z.infer<typeof processCatalogueImportSchema>,
  userId: string,
) {
  const { data: job, error: jobError } = await supabase
    .from("automation_jobs")
    .select("id,payload,updated_at")
    .eq("id", input.importId)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job) return NextResponse.json({ error: "Catalogue import was not found." }, { status: 404 });

  const parsedPayload = catalogueImportPayloadSchema.safeParse(job.payload);
  if (!parsedPayload.success || parsedPayload.data.uploadedBy !== userId) {
    return NextResponse.json({ error: "You are not authorized to resume this catalogue import." }, { status: 403 });
  }
  const payload = parsedPayload.data;
  const totalBatches = Math.ceil(payload.items.length / IMPORT_BATCH_SIZE);
  if (input.batchIndex < payload.nextBatch) {
    return NextResponse.json(catalogueProgress(payload, totalBatches, payload.nextBatch >= totalBatches));
  }
  if (input.batchIndex !== payload.nextBatch) {
    return NextResponse.json({ error: "Import batches must be processed in order. Resume from the saved progress." }, { status: 409 });
  }
  if (payload.nextBatch >= totalBatches) {
    return NextResponse.json(catalogueProgress(payload, totalBatches, true));
  }

  const [products, { data: departments, error: departmentError }, { data: categories, error: categoryError }, { data: brands, error: brandError }] = await Promise.all([
    loadCatalogueProducts(supabase),
    supabase.from("departments").select("id,name").eq("is_active", true),
    supabase.from("categories").select("id,name,department_id,parent_id").eq("is_active", true),
    supabase.from("brands").select("id,name").eq("is_active", true),
  ]);
  if (departmentError || categoryError || brandError) throw departmentError ?? categoryError ?? brandError;
  const brandNameById = new Map((brands ?? []).map((brand) => [brand.id, brand.name]));
  const matchableProducts = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    brandName: product.brand_id ? brandNameById.get(product.brand_id) ?? null : null,
  }));
  const batchStart = input.batchIndex * IMPORT_BATCH_SIZE;
  const batch = payload.items.slice(batchStart, batchStart + IMPORT_BATCH_SIZE);
  const duplicateRows = findDuplicateCatalogueIdentifiers(payload.items);
  const matchRecords = batch.map((item) => {
    const internalCodeMatches = item.itemCode
      ? products.filter((product) => normalizeProductName(product.internal_code ?? "") === normalizeProductName(item.itemCode ?? ""))
      : [];
    const barcodeMatches = item.barcode
      ? products.filter((product) => product.barcode?.trim().toLowerCase() === item.barcode?.trim().toLowerCase())
      : [];
    const taxonomy = matchCatalogueTaxonomy(item, departments ?? [], categories ?? [], brands ?? []);
    const conflictingIdentifiers = internalCodeMatches.length === 1
      && barcodeMatches.length === 1
      && internalCodeMatches[0].id !== barcodeMatches[0].id;
    const candidate = conflictingIdentifiers
      ? { productId: null, status: "POSSIBLE_MATCH" as const, confidence: 0.5, reasons: ["Internal code and barcode identify different products; human review required"] }
      : internalCodeMatches.length > 1 || barcodeMatches.length > 1
        ? { productId: null, status: "POSSIBLE_MATCH" as const, confidence: 0.5, reasons: ["Identifier matches multiple active products; human review required"] }
        : internalCodeMatches.length === 1
          ? { productId: internalCodeMatches[0].id, status: "MATCHED" as const, confidence: 1, reasons: ["Exact Dantown internal code match"] }
        : matchProduct({
          name: item.name,
          barcode: item.barcode ?? undefined,
          brandName: item.brand ?? undefined,
        }, matchableProducts);
    const reviewFlags = [...item.warnings, ...(duplicateRows.get(item.rowNumber) ?? [])];
    if (conflictingIdentifiers) reviewFlags.push("CSV identifiers point to different existing products.");
    if (item.itemCode === null) reviewFlags.push("Dantown item code is missing.");
    if (item.department && !taxonomy.departmentMapped) reviewFlags.push(`Department "${item.department}" does not uniquely match an active department.`);
    if (item.category && !taxonomy.categoryMapped) reviewFlags.push(`Category "${item.category}" does not uniquely match an active category in the selected department.`);
    if (item.brand && !taxonomy.brandMapped) reviewFlags.push(`Brand "${item.brand}" does not uniquely match an active brand.`);
    if ((item.stockQuantity ?? item.openingStock ?? item.currentStock) !== null) {
      reviewFlags.push("CSV stock values are review-only and will not change inventory.");
    }
    if (item.costPrice === null) reviewFlags.push("Cost price is missing.");
    if (item.wholesalePrice === null) reviewFlags.push("Wholesale price is missing.");
    if (item.dealerPrice === null) reviewFlags.push("Dealer price is missing.");
    if (item.retailPrice === null) reviewFlags.push("Retail price is missing or invalid.");
    if (candidate.status !== "MATCHED") reviewFlags.push(...candidate.reasons);
    return {
      id: stableMatchId(payload.importId, item.rowNumber),
      automation_job_id: payload.importId,
      product_id: candidate.productId ?? null,
      supplier_id: null,
      supplier_sku: item.itemCode,
      source_name: payload.fileName,
      normalized_name: item.name,
      match_status: candidate.status,
      confidence: candidate.confidence,
      match_reasons: {
        candidateReasons: candidate.reasons,
        catalogueRow: item,
        taxonomy,
        reviewFlags: Array.from(new Set(reviewFlags)),
        proposedFieldMapping: {
          itemCode: "products.internal_code",
          name: "products.name",
          brand: "brands.name -> products.brand_id",
          department: "departments.name -> categories.department_id",
          category: "categories.name -> products.category_id",
          description: "products.description",
          manufacturerCode: "products.manufacturer_part_number",
          barcode: "products.barcode",
          retailPrice: "products.retail_price",
          wholesalePrice: "products.wholesale_price",
          dealerPrice: "products.dealer_price",
          costPrice: "products.cost_price",
          unit: "products.unit_of_measure",
          imageUrl: "product_images.image_url",
          declaredStatus: "review only; new products remain drafts",
          posEnabled: "review only; existing POS visibility is not changed",
          stockQuantity: "review only; inventory is not changed",
          openingStock: "review only; inventory is not changed",
          currentStock: "review only; inventory is not changed",
        },
      },
      reviewed_by: null,
    };
  });

  const { error: matchError } = await supabase
    .from("product_matches")
    .upsert(matchRecords, { onConflict: "id", ignoreDuplicates: true });
  if (matchError) throw matchError;

  const batchMatchedRows = matchRecords.filter((match) => match.match_status === "MATCHED").length;
  const batchNeedsReview = matchRecords.filter((match) => {
    const reasons = match.match_reasons as { reviewFlags?: string[] };
    return match.match_status !== "MATCHED" || Boolean(reasons.reviewFlags?.length);
  }).length;
  const nextBatch = payload.nextBatch + 1;
  const nextPayload = {
    ...payload,
    nextBatch,
    processedRows: Math.min(payload.items.length, payload.processedRows + batch.length),
    matchedRows: payload.matchedRows + batchMatchedRows,
    requiresReview: payload.requiresReview + batchNeedsReview,
    departmentMappedRows: payload.departmentMappedRows + matchRecords.filter((match) => (match.match_reasons as { taxonomy: { departmentMapped: boolean } }).taxonomy.departmentMapped).length,
    categoryMappedRows: payload.categoryMappedRows + matchRecords.filter((match) => (match.match_reasons as { taxonomy: { categoryMapped: boolean } }).taxonomy.categoryMapped).length,
    brandMappedRows: payload.brandMappedRows + matchRecords.filter((match) => (match.match_reasons as { taxonomy: { brandMapped: boolean } }).taxonomy.brandMapped).length,
  };
  const complete = nextBatch >= totalBatches;
  const { data: updatedJob, error: updateError } = await supabase
    .from("automation_jobs")
    .update({
      payload: nextPayload,
      status: complete
        ? nextPayload.requiresReview > 0 ? "REQUIRES_REVIEW" : "COMPLETED"
        : "PROCESSING",
      completed_at: complete ? new Date().toISOString() : null,
    })
    .eq("id", payload.importId)
    .eq("updated_at", job.updated_at)
    .select("id")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updatedJob) {
    const { data: latestJob, error: latestError } = await supabase
      .from("automation_jobs")
      .select("payload")
      .eq("id", payload.importId)
      .maybeSingle();
    if (latestError) throw latestError;
    const latestPayload = catalogueImportPayloadSchema.safeParse(latestJob?.payload);
    if (!latestPayload.success || latestPayload.data.uploadedBy !== userId) {
      return NextResponse.json({ error: "Catalogue import progress changed. Reload the job and resume it." }, { status: 409 });
    }
    if (latestPayload.data.nextBatch <= payload.nextBatch) {
      return NextResponse.json({ error: "This batch is already being processed. Re-select the same CSV to resume." }, { status: 409 });
    }
    return NextResponse.json(catalogueProgress(latestPayload.data, totalBatches, latestPayload.data.nextBatch >= totalBatches));
  }

  return NextResponse.json(catalogueProgress(nextPayload, totalBatches, complete));
}

export async function POST(request: Request) {
  try {
    const automationGuard = await getPermissionGuard("automation.manage");
    if (!automationGuard.ok) {
      return NextResponse.json({ error: automationGuard.message }, { status: automationGuard.status });
    }
    const productGuard = await getPermissionGuard("products.update");
    if (!productGuard.ok) {
      return NextResponse.json({ error: productGuard.message }, { status: productGuard.status });
    }
    const supabase = await createSupabaseServerClient();
    const body = await readJsonBody(request);
    const action = typeof body === "object" && body !== null && "action" in body ? body.action : null;

    if (action === "start") {
      const parsed = startCatalogueImportSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Upload the supported catalogue CSV and correct all invalid rows." }, { status: 400 });
      }
      return startCatalogueImport(supabase, parsed.data, automationGuard.context.userId);
    }

    if (action === "process") {
      const parsed = processCatalogueImportSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Choose a valid import batch to resume." }, { status: 400 });
      return processCatalogueImport(supabase, parsed.data, automationGuard.context.userId);
    }

    const parsed = supplierImportSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Upload a valid product CSV with at least one row." }, { status: 400 });
    const { data: products, error: productError } = await supabase.from("products").select("id,name,sku,barcode").eq("is_active", true);
    if (productError) throw productError;
    const { data: job, error: jobError } = await createAutomationJob(supabase, {
      workflowName: "PRODUCT_INGESTION",
      source: "CENTRE_UPLOAD",
      sourceReference: parsed.data.fileName,
      payload: { fileName: parsed.data.fileName, items: parsed.data.items, uploadedBy: automationGuard.context.userId },
    });
    if (jobError || !job) throw jobError ?? new Error("Unable to create import job");
    let requiresReview = 0;
    for (const item of parsed.data.items) {
      const candidate = matchProduct(
        { name: item.name, sku: item.sku ?? undefined, barcode: item.barcode ?? undefined },
        (products ?? []).map((product) => ({ id: product.id, name: product.name, sku: product.sku, barcode: product.barcode, brandName: null })),
      );
      if (candidate.status !== "MATCHED") requiresReview += 1;
      const { error } = await saveProductMatch(supabase, {
        automation_job_id: job.id,
        product_id: candidate.productId ?? null,
        supplier_id: null,
        supplier_sku: item.sku,
        source_name: parsed.data.fileName,
        normalized_name: item.name,
        match_status: candidate.status,
        confidence: candidate.confidence,
        match_reasons: candidate.reasons,
        reviewed_by: null,
      });
      if (error) throw error;
    }
    const { error: updateError } = await supabase.from("automation_jobs")
      .update({ status: requiresReview ? "REQUIRES_REVIEW" : "COMPLETED", completed_at: new Date().toISOString() })
      .eq("id", job.id);
    if (updateError) throw updateError;
    return NextResponse.json({ jobId: job.id, importedRows: parsed.data.items.length, requiresReview });
  } catch (error) {
    console.error("CENTRE IMPORT ERROR", error);
    if (error instanceof ImportPayloadTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Import request must contain valid JSON." }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process import." }, { status: 500 });
  }
}
