import { NextResponse } from "next/server";
import { z } from "zod";
import { getPermissionGuard, getStaffIdentity } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const checkoutSchema = z.object({
  requestId: z.string().uuid(),
  customerId: z.string().uuid().nullable(),
  cashReceived: z.number().finite().nonnegative().max(1_000_000_000),
  subtotal: z.number().finite().nonnegative(),
  vat: z.number().finite().nonnegative(),
  total: z.number().finite().positive(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().max(100_000),
  })).min(1).max(500),
});
const offlineHeadersSchema = z.object({
  transactionId: z.string().uuid(),
  deviceId: z.string().min(1).max(120),
  staffId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const guard = await getPermissionGuard("orders.create");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
    const rawOfflineHeaders = {
      transactionId: request.headers.get("X-Offline-Transaction-Id"),
      deviceId: request.headers.get("X-Offline-Device-Id"),
      staffId: request.headers.get("X-Offline-Staff-Id"),
    };
    const hasOfflineHeader = Object.values(rawOfflineHeaders).some(Boolean);
    const offlineHeaders = hasOfflineHeader
      ? offlineHeadersSchema.safeParse(rawOfflineHeaders)
      : null;
    if (offlineHeaders && !offlineHeaders.success) {
      return NextResponse.json({ error: "Offline sale identity is incomplete or invalid." }, { status: 400 });
    }
    const parsed = checkoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Review the cash amount and sale items." }, { status: 400 });
    }
    const staff = await getStaffIdentity(guard.context);
    if (offlineHeaders?.success && (
      offlineHeaders.data.staffId !== staff.userId
      || offlineHeaders.data.transactionId !== parsed.data.requestId
    )) {
      return NextResponse.json({ error: "Offline sale owner or transaction identity does not match this request." }, { status: 403 });
    }
    const supabase = createSupabaseServiceClient();
    const { data: activeSessions, error: sessionError } = await supabase
      .from("pos_sessions")
      .select("id")
      .eq("employee_id", staff.userId)
      .eq("status", "OPEN")
      .limit(2);
    if (sessionError) throw sessionError;
    if (activeSessions?.length !== 1) {
      const retryableOfflineError = offlineHeaders?.success && activeSessions?.length === 0;
      return NextResponse.json({
        error: activeSessions?.length
          ? "More than one open cash session exists. Reconcile them before accepting cash."
          : "Open a cash session before accepting cash."
      }, { status: retryableOfflineError ? 503 : 409 });
    }
    const saleItems = parsed.data.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
    }));
    const { data: order, error: orderError } = offlineHeaders?.success
      ? await supabase.rpc("complete_pos_offline_cash_sale", {
        sale_offline_transaction_id: offlineHeaders.data.transactionId,
        sale_offline_device_id: offlineHeaders.data.deviceId,
        sale_staff_user_id: staff.userId,
        sale_order_number: `DT-OF-${offlineHeaders.data.transactionId.replaceAll("-", "").slice(0, 16).toUpperCase()}`,
        sale_customer_id: parsed.data.customerId,
        sale_subtotal: parsed.data.subtotal,
        sale_vat: parsed.data.vat,
        sale_total: parsed.data.total,
        sale_staff_name: staff.name,
        sale_staff_role: staff.role,
        sale_items: saleItems,
        sale_cash_received: parsed.data.cashReceived,
        sale_payload: parsed.data,
      })
      : await supabase.rpc("complete_pos_cash_sale", {
        sale_order_number: `DT-CS-${parsed.data.requestId.replaceAll("-", "").slice(0, 16).toUpperCase()}`,
        sale_customer_id: parsed.data.customerId,
        sale_subtotal: parsed.data.subtotal,
        sale_vat: parsed.data.vat,
        sale_total: parsed.data.total,
        sale_staff_user_id: staff.userId,
        sale_staff_name: staff.name,
        sale_staff_role: staff.role,
        sale_items: saleItems,
        sale_cash_received: parsed.data.cashReceived,
      });
    if (orderError || !order) {
      console.error("POS cash checkout failed:", orderError);
      return NextResponse.json({
        error: orderError?.code === "23505"
          ? "This cash sale has already been submitted. Check the order register before accepting payment again."
          : orderError?.message ?? "Unable to record this cash sale.",
      }, { status: orderError?.code === "23505" ? 409 : 400 });
    }

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("product_name_snapshot,sku_snapshot,quantity,line_total,vat")
      .eq("order_id", order.id);
    if (itemsError) throw itemsError;
    if (!items?.length) throw new Error("The confirmed cash sale has no recorded items.");
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id")
      .eq("order_id", order.id)
      .eq("status", "SUCCESS")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) throw new Error("The confirmed cash sale has no verified payment record.");
    const { data: receiptDocument, error: receiptError } = await supabase.rpc("issue_verified_payment_receipt", {
      target_payment_id: payment.id,
      actor_user_id: staff.userId,
    });
    if (receiptError || !receiptDocument) throw receiptError ?? new Error("Verified payment receipt could not be issued.");

    return NextResponse.json({
      success: true,
      change: Number((parsed.data.cashReceived - Number(order.total)).toFixed(2)),
      receipt: {
        orderId: order.id,
        receiptNumber: receiptDocument.document_number,
        subtotal: Number(order.subtotal),
        discount: Number(order.discount),
        tax: Number(order.vat),
        delivery: Number(order.delivery_fee),
        total: Number(order.total),
        paymentMethod: "Cash",
        date: order.created_at,
        items: items.map((item) => ({
          name: item.product_name_snapshot,
          sku: item.sku_snapshot,
          qty: item.quantity,
          total: Number(item.line_total) + Number(item.vat),
        })),
      },
    });
  } catch (error) {
    console.error("POS cash checkout request failed:", error);
    return NextResponse.json({ error: "Unable to record this POS cash sale." }, { status: 500 });
  }
}
