import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthorizedPermission } from "../../../../../lib/auth/server";
import { createSupabaseServiceClient } from "../../../../../lib/supabase/server";

const returnSchema = z.object({ reason: z.string().trim().min(3).max(240), amount: z.number().positive() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthorizedPermission("refunds.request");
    const { id } = await params;
    const body = returnSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Return reason and amount are required." }, { status: 400 });

    const supabase = createSupabaseServiceClient();
    const { data: result, error } = await supabase.rpc("process_return", { order_id: id, refund_reason: body.data.reason, refund_amount: body.data.amount, staff_user_id: context.userId });
    if (error || !result) return NextResponse.json({ error: error?.message || "Unable to process return." }, { status: 400 });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("RETURN PROCESSING ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process return." }, { status: 500 });
  }
}
