import { NextResponse } from "next/server";
import { z } from "zod";
import { PaywaveApiError, PaywaveConfigurationError } from "@/lib/payments/paywave";
import { verifyAndCompletePaywaveTransaction } from "@/lib/payments/paywave-online";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const webhookSchema = z.object({
  CheckoutRequestID: z.string().trim().min(1).max(255),
  TransactionID: z.string().trim().max(255).optional(),
  ResponseCode: z.union([z.string(), z.number()]).optional(),
}).passthrough();

export async function POST(request: Request) {
  const parsed = webhookSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Paywave Express callback." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data: transaction, error } = await supabase
      .from("payment_transactions")
      .select("provider_reference")
      .eq("checkout_request_id", parsed.data.CheckoutRequestID)
      .maybeSingle();
    if (error) throw error;
    if (!transaction?.provider_reference) {
      return NextResponse.json({ status: "received", verified: false }, { status: 202 });
    }

    // Paywave's published callback example does not specify a signature; always verify through its status API.
    const result = await verifyAndCompletePaywaveTransaction(transaction.provider_reference);
    return NextResponse.json({ status: "received", verified: result.status === "completed" });
  } catch (error) {
    if (error instanceof PaywaveConfigurationError || error instanceof PaywaveApiError) {
      console.error("Paywave Express callback verification is temporarily unavailable.", error.message);
      return NextResponse.json({ error: "Unable to verify Paywave Express callback yet." }, { status: 503 });
    }
    console.error("Paywave Express callback processing failed:", error);
    return NextResponse.json({ error: "Unable to process Paywave Express callback." }, { status: 500 });
  }
}
