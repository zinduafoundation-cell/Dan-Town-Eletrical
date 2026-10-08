import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Tells the browser whether a "Finish your order" reminder is still valid.
 * It is valid only for the signed-in owner of an order that is genuinely
 * waiting for payment. Guests, other accounts, paid, cancelled and deleted
 * orders all get { pending: false } so the browser can clear the reminder.
 */
export async function GET(request: Request) {
  const context = await getAuthorizationContext();
  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!context || !orderId || context.userId === "dev-bypass-user") {
    return NextResponse.json({ pending: false, userId: context?.userId ?? null });
  }

  const { data: order } = await createSupabaseServiceClient()
    .from("orders")
    .select("id, created_by, payment_status, order_status")
    .eq("id", orderId)
    .maybeSingle();

  const owned = order?.created_by === context.userId;
  const waiting = order?.payment_status === "PENDING" && ["PENDING", "PAYMENT_PENDING"].includes(String(order?.order_status));
  return NextResponse.json({ pending: Boolean(order && owned && waiting), userId: context.userId });
}
