import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaffIdentity, requireAuthorizedPermission } from "@/lib/auth/server";
import { getAppUrl } from "@/lib/env";
import { getPesapalConfig, PesapalApiError } from "@/lib/payments/pesapal";
import { isPaymentProviderAvailable } from "@/lib/payments/payment-provider-settings";
import { initializePesapalCheckout } from "@/lib/payments/pesapal-checkout";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const initSchema = z.object({
  requestId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(32).nullable().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
});

export async function POST(request: Request) {
  if (!getPesapalConfig()) {
    return NextResponse.json({ error: "Pesapal is not configured for this deployment." }, { status: 503 });
  }

  try {
    const context = await requireAuthorizedPermission("orders.create");
    if (!(await isPaymentProviderAvailable("pos", "pesapal"))) {
      return NextResponse.json({ error: "Pesapal POS checkout is disabled or not configured." }, { status: 503 });
    }
    const staff = await getStaffIdentity(context);
    const parsed = initSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid customer email and sale details." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: order, error: orderError } = await supabase.rpc("create_pos_pesapal_order", {
      sale_order_number: `DT-PS-${parsed.data.requestId.replaceAll("-", "").slice(0, 16).toUpperCase()}`,
      sale_customer_id: parsed.data.customerId ?? null,
      sale_customer_name: parsed.data.customerName,
      sale_staff_user_id: staff.userId,
      sale_staff_name: staff.name,
      sale_staff_role: staff.role,
      sale_items: parsed.data.items,
    });
    if (orderError || !order) {
      console.error("Pesapal POS order preparation failed:", orderError);
      return NextResponse.json({ error: orderError?.message ?? "Unable to prepare this sale." }, { status: 409 });
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id")
      .eq("order_id", order.id)
      .eq("provider", "PESAPAL")
      .eq("status", "PENDING")
      .maybeSingle();
    if (paymentError || !payment) {
      console.error("Pesapal POS payment record missing:", paymentError);
      return NextResponse.json({ error: "Unable to prepare this sale for payment." }, { status: 500 });
    }

    const callbackUrl = new URL("/payment/pesapal-callback", getAppUrl(request));
    callbackUrl.searchParams.set("orderId", order.id);
    callbackUrl.searchParams.set("channel", "POS");
    const redirectUrl = await initializePesapalCheckout({
      supabase,
      paymentId: payment.id,
      order,
      email: parsed.data.email,
      phone: parsed.data.phone,
      callbackUrl: callbackUrl.toString(),
    });
    return NextResponse.json({ redirectUrl, orderId: order.id, orderNumber: order.order_number });
  } catch (error) {
    console.error("Pesapal POS checkout initialization failed:", error);
    const status = error instanceof PesapalApiError ? error.status ?? 502 : 500;
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to start Pesapal checkout.",
    }, { status: status >= 400 && status <= 599 ? status : 502 });
  }
}
