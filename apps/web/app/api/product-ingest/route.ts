import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@dantown/auth";
import { ProductSubmissionSchema, buildProductReviewSummary, classifyProductAction, validateProductSubmission } from "@/lib/product-ingest/ingest";
import { getAuthorizationContext } from "@/lib/auth/server";
import { N8N_SECRET_HEADER, verifyAutomationSecret } from "@/lib/automation/security";
import { persistAutomationEvent } from "@/lib/automation/ingest";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const hasAutomationHeader = request.headers.has(N8N_SECRET_HEADER);
  let actor: "N8N" | "STAFF" | null = null;

  if (hasAutomationHeader) {
    const authResult = verifyAutomationSecret(request);
    if (!authResult.ok) return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status });
    actor = "N8N";
  } else {
    const context = await getAuthorizationContext();
    if (!context || (!hasPermission(context, "products.update") && !hasPermission(context, "automation.manage"))) {
      return NextResponse.json({ ok: false, error: "Product ingestion permission required." }, { status: context ? 403 : 401 });
    }
    actor = "STAFF";
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const submission = body.product ?? body;
    const parsed = ProductSubmissionSchema.safeParse(submission);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid product submission.", details: parsed.error.issues }, { status: 400 });
    }

    const validation = validateProductSubmission(parsed.data);
    if (!validation.ok || !validation.normalized) {
      return NextResponse.json({ ok: false, error: "Product submission requires review.", details: validation.errors }, { status: 422 });
    }

    const supabase = createSupabaseServiceClient();
    const sku = validation.normalized.sku;
    const existingQuery = sku
      ? supabase.from("products").select("id, sku, name, brand:brands(name)").eq("sku", sku).limit(1)
      : supabase.from("products").select("id, sku, name, brand:brands(name)").ilike("name", validation.normalized.name).limit(10);
    const { data: existingRows } = await existingQuery;
    const existingRow = existingRows?.[0] as { id?: string; sku?: string | null; name?: string | null; brand?: { name?: string } | { name?: string }[] | null } | undefined;
    const existingBrand = Array.isArray(existingRow?.brand) ? existingRow.brand[0]?.name : existingRow?.brand?.name;
    const action = classifyProductAction(validation.normalized, existingRow ? { sku: existingRow.sku, name: existingRow.name, brand: existingBrand } : null);
    const reviewSummary = buildProductReviewSummary(validation.normalized);
    const { data: job, error } = await persistAutomationEvent({
      workflowName: "PRODUCT_INGESTION",
      source: actor === "N8N" ? validation.normalized.source : "MANUAL",
      sourceReference: typeof body.sourceReference === "string" ? body.sourceReference : null,
      payload: { action, product: validation.normalized, review: reviewSummary, existingProductId: existingRow?.id ?? null }
    });

    if (error || !job) return NextResponse.json({ ok: false, error: "Unable to queue product review." }, { status: 500 });
    return NextResponse.json({ ok: true, status: "REVIEW_REQUIRED", action, jobId: job.id, existingProductId: existingRow?.id ?? null }, { status: 202 });
  } catch (error) {
    console.error("Product ingestion failed:", error);
    return NextResponse.json({ ok: false, error: "Product ingestion failed." }, { status: 500 });
  }
}
