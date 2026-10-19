import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthorizedPermission } from "../../../../../lib/auth/server";
import { createSupabaseServiceClient } from "../../../../../lib/supabase/server";
import { requireBiometricStepUp } from "../../../../../lib/auth/passkeys";

const returnSchema = z.object({
  reason: z.string().trim().min(3).max(240),
  amount: z.number().finite().positive().max(1_000_000_000).refine((amount) => Number(amount.toFixed(2)) === amount),
  cashReturned: z.literal(true)
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthorizedPermission("refunds.request");
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Return not found." }, { status: 404 });
    }
    // Refunds move money: if this staff member has a linked phone, they must confirm with it first.
    const stepUpRequired = await requireBiometricStepUp(context.userId);
    if (stepUpRequired) return stepUpRequired;
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: "Return reason, amount, and cash-return confirmation are required." }, { status: 400 });
    }
    const body = returnSchema.safeParse(input);
    if (!body.success) return NextResponse.json({ error: "Return reason, amount, and cash-return confirmation are required." }, { status: 400 });

    const supabase = createSupabaseServiceClient();
    const { data: result, error } = await supabase.rpc("process_return", { order_id: id, refund_reason: body.data.reason, refund_amount: body.data.amount, staff_user_id: context.userId });
    if (error || !result) {
      console.error("Unable to record POS cash refund:", error);
      const message = error?.message ?? "Unable to process return.";
      const status = /not found/i.test(message) ? 404
        : /already|remaining refundable|exactly one|split payments|only records cash|successful payment|cannot be refunded|no longer open/i.test(message) ? 409
          : /required|greater than zero|between 3 and 240|no more than two decimal places/i.test(message) ? 400 : 500;
      return NextResponse.json({ error: status === 500 ? "Unable to record this cash refund." : message }, { status });
    }
    return NextResponse.json({ success: true, result, message: "Cash refund recorded and included in the open drawer reconciliation." });
  } catch (error) {
    console.error("RETURN PROCESSING ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process return." }, { status: 500 });
  }
}
