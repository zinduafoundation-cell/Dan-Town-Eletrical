import { NextResponse } from "next/server";
import { z } from "zod";
import { createAutomationJob, saveProductMatch } from "@dantown/database";
import { matchProduct } from "@dantown/shared";
import { requireAuthorizedPermission } from "../../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

const importSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  items: z.array(z.object({ name: z.string().trim().min(1), sku: z.string().trim().nullable(), barcode: z.string().trim().nullable(), quantity: z.number().int().nonnegative(), unitCost: z.number().nonnegative() })).min(1).max(1000)
});

export async function POST(request: Request) {
  try {
    const context = await requireAuthorizedPermission("automation.manage");
    const parsed = importSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Upload a valid product CSV with at least one row." }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data: products, error: productError } = await supabase.from("products").select("id,name,sku,barcode").eq("is_active", true);
    if (productError) throw productError;
    const { data: job, error: jobError } = await createAutomationJob(supabase, { workflowName: "PRODUCT_INGESTION", source: "CENTRE_UPLOAD", sourceReference: parsed.data.fileName, payload: { fileName: parsed.data.fileName, items: parsed.data.items, uploadedBy: context.userId } });
    if (jobError || !job) throw jobError ?? new Error("Unable to create import job");
    let requiresReview = 0;
    for (const item of parsed.data.items) {
      const candidate = matchProduct({ name: item.name, sku: item.sku ?? undefined, barcode: item.barcode ?? undefined }, (products ?? []).map((product) => ({ id: product.id, name: product.name, sku: product.sku, barcode: product.barcode, brandName: null })));
      if (candidate.status !== "MATCHED") requiresReview += 1;
      const { error } = await saveProductMatch(supabase, { automation_job_id: job.id, product_id: candidate.productId ?? null, supplier_id: null, supplier_sku: item.sku, source_name: parsed.data.fileName, normalized_name: item.name, match_status: candidate.status, confidence: candidate.confidence, match_reasons: candidate.reasons, reviewed_by: null });
      if (error) throw error;
    }
    await supabase.from("automation_jobs").update({ status: requiresReview ? "REQUIRES_REVIEW" : "COMPLETED", completed_at: new Date().toISOString() }).eq("id", job.id);
    return NextResponse.json({ jobId: job.id, importedRows: parsed.data.items.length, requiresReview });
  } catch (error) {
    console.error("CENTRE IMPORT ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process import." }, { status: 500 });
  }
}
