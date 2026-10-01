import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizationContext } from "@/lib/auth/server";
import { matchCatalogItems, matchCatalogProducts } from "@/lib/dantown-ai/product-matcher";
import { parseSmartMatchFile } from "@/lib/dantown-ai/quotation-parser";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const maxDuration = 45;

const maxUploadBytes = 10 * 1024 * 1024;
const supportedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const rateBuckets = new Map<string, { count: number; expiresAt: number }>();

function checkRateLimit(request: Request) {
  const now = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const existing = rateBuckets.get(ip);
  if (existing && existing.expiresAt > now && existing.count >= 10) return false;
  if (!existing || existing.expiresAt <= now) rateBuckets.set(ip, { count: 1, expiresAt: now + 10 * 60_000 });
  else existing.count += 1;
  if (rateBuckets.size > 5000) {
    for (const [key, bucket] of rateBuckets) if (bucket.expiresAt <= now) rateBuckets.delete(key);
  }
  return true;
}

function isAllowedFileSignature(file: File, bytes: Uint8Array) {
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (file.type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (file.type === "application/pdf") return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  return false;
}

async function recordSmartMatchEvent(
  userId: string | null,
  action: string,
  metadata: Record<string, number | string>,
) {
  const safeUserId = userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    ? userId
    : null;
  const { error } = await createSupabaseServiceClient().from("audit_logs").insert({
    user_id: safeUserId,
    action,
    resource_type: "smart_match",
    resource_id: null,
    new_data: metadata,
  });
  if (error) console.error("Unable to record Smart Match event:", error.message);
}

export async function GET(request: Request) {
  if (!checkRateLimit(request)) return NextResponse.json({ error: "Too many searches. Please wait a few minutes and try again." }, { status: 429 });
  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
  const parsed = z.string().min(2).max(160).safeParse(query);
  if (!parsed.success) return NextResponse.json({ error: "Enter a product name, brand or specification." }, { status: 400 });

  try {
    const context = await getAuthorizationContext();
    const matches = await matchCatalogProducts(createSupabaseServiceClient(), parsed.data);
    await recordSmartMatchEvent(context?.userId ?? null, matches[0]?.product ? "SMART_MATCH_FOUND" : "SMART_MATCH_NOT_FOUND", {
      match_count: matches.filter((match) => match.product).length,
      method: "manual_search",
    });
    return NextResponse.json({ matches });
  } catch (error) {
    console.error("Smart Match product search failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Product search is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > maxUploadBytes + 64 * 1024) return NextResponse.json({ error: "That file is too large. Please upload a file under 10 MB." }, { status: 413 });
  if (!checkRateLimit(request)) return NextResponse.json({ error: "Too many scans. Please wait a few minutes and try again." }, { status: 429 });

  let context: Awaited<ReturnType<typeof getAuthorizationContext>> = null;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Please choose a quotation or product image." }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: "The selected file is empty." }, { status: 400 });
    if (file.size > maxUploadBytes) return NextResponse.json({ error: "That file is too large. Please upload a file under 10 MB." }, { status: 413 });
    if (!supportedMimeTypes.has(file.type)) return NextResponse.json({ error: "Unsupported file type. Use JPG, PNG, WEBP or PDF." }, { status: 415 });

    const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!isAllowedFileSignature(file, signature)) return NextResponse.json({ error: "The file content does not match its file type. Please select a valid image or PDF." }, { status: 415 });

    const kind = form.get("kind") === "product" ? "product" : "quotation";
    context = await getAuthorizationContext();
    const extracted = await parseSmartMatchFile(file, kind);
    const matches = await matchCatalogItems(
      createSupabaseServiceClient(),
      extracted.map((item) => ({
        requestedName: [item.brand, item.model, item.requestedName, ...Object.values(item.specifications)].filter(Boolean).join(" "),
        requestedQuantity: item.quantity,
      })),
    );
    const results = matches.map((match, index) => ({
      ...match,
      requestedName: extracted[index].requestedName,
      extracted: {
        brand: extracted[index].brand ?? null,
        model: extracted[index].model ?? null,
        specifications: extracted[index].specifications,
        unit: extracted[index].unit,
      },
    }));
    await recordSmartMatchEvent(context?.userId ?? null, kind === "quotation" ? "SMART_MATCH_QUOTATION_SCANNED" : "SMART_MATCH_PRODUCT_IDENTIFIED", {
      item_count: results.length,
      matched_count: results.filter((match) => match.product).length,
      partial_count: results.filter((match) => match.status === "PARTIALLY_AVAILABLE").length,
      unmatched_count: results.filter((match) => match.status === "NOT_FOUND").length,
    });
    return NextResponse.json({
      matches: results,
      message: `Analyzed ${results.length} item${results.length === 1 ? "" : "s"}. Current product details and available quantities are from Dantown's catalogue and inventory.`,
    });
  } catch (error) {
    console.error("Smart Match scan failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The file could not be analyzed. Try a clearer image or manual search." }, { status: 503 });
  }
}
