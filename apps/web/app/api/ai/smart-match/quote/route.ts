import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizationContext } from "@/lib/auth/server";
import { matchCatalogItems } from "@/lib/dantown-ai/product-matcher";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const quoteRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(30),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  notes: z.string().trim().max(500).default(""),
  items: z.array(z.object({
    requestedName: z.string().trim().min(2).max(180),
    requestedQuantity: z.number().int().min(1).max(100_000),
  })).min(1).max(25),
});

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? "0") > 24_000) {
    return NextResponse.json({ error: "The request is too large." }, { status: 413 });
  }

  const parsed = quoteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Add your name and phone number and check the quotation items." }, { status: 400 });

  try {
    const context = await getAuthorizationContext();
    const matches = await matchCatalogItems(
      createSupabaseServiceClient(),
      parsed.data.items.map(({ requestedName, requestedQuantity }) => ({ requestedName, requestedQuantity })),
    );
    const itemSummary = matches.map((match, index) =>
      `${index + 1}. ${match.requestedName} x ${match.requestedQuantity}; match: ${match.product?.name ?? "none"}; status: ${match.status}; available: ${match.product?.availableQuantity ?? 0}; alternatives: ${match.alternatives.map(({ name }) => name).join(", ") || "none"}`,
    ).join("\n");
    const contactSummary = [
      `Contact: ${parsed.data.name}`,
      `Phone: ${parsed.data.phone}`,
      parsed.data.email ? `Email: ${parsed.data.email}` : null,
      parsed.data.notes ? `Notes: ${parsed.data.notes}` : null,
      "Requested items:",
      itemSummary,
    ].filter(Boolean).join("\n").slice(0, 8000);
    const { data, error } = await createSupabaseServiceClient()
      .from("ai_support_escalations")
      .insert({
        user_id: context?.userId && context.userId !== "dev-bypass-user" ? context.userId : null,
        guest_session_id: null,
        category: "SMART_MATCH_QUOTE",
        summary: contactSummary,
        priority: "NORMAL",
        status: "OPEN",
        assigned_to: null,
      })
      .select("id, created_at")
      .single();

    if (error || !data) {
      console.error("Unable to create Smart Match quote request:", error?.message ?? "No escalation returned");
      return NextResponse.json({ error: "The quote request could not be saved. Please try again or contact our team." }, { status: 500 });
    }

    const safeUserId = context?.userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(context.userId)
      ? context.userId
      : null;
    const { error: auditError } = await createSupabaseServiceClient().from("audit_logs").insert({
      user_id: safeUserId,
      action: "SMART_MATCH_QUOTE_REQUESTED",
      resource_type: "smart_match",
      resource_id: null,
      new_data: { request_id: data.id, item_count: parsed.data.items.length },
    });
    if (auditError) console.error("Unable to audit Smart Match quote request:", auditError.message);

    return NextResponse.json({ requestId: data.id, createdAt: data.created_at }, { status: 201 });
  } catch (error) {
    console.error("Smart Match quote request failed:", error);
    return NextResponse.json({ error: "The quote request could not be saved. Please try again." }, { status: 500 });
  }
}
