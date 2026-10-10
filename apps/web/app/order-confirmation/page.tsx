import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, Check } from "lucide-react";
import { StorefrontShell } from "@/components/storefront";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/store-data";
import { getOrderStatusLabel } from "@/lib/order-lifecycle";

export const metadata: Metadata = {
  title: "Order Status",
  description: "View the current status of your Dantown Electrical order."
};

export default async function OrderConfirmationPage({
  searchParams
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const params = await searchParams;
  const rawId = params.orderId ?? "";
  let order: {
    order_number: string;
    order_status: string;
    payment_status: string;
    subtotal: number;
    vat: number;
    delivery_fee: number;
    total: number;
  } | null = null;

  if (rawId) {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("orders")
      .select("order_number,order_status,payment_status,subtotal,vat,delivery_fee,total")
      .eq("id", rawId)
      .maybeSingle();
    if (error) throw new Error(`Unable to load order status: ${error.message}`);
    order = data;
  }
  const paymentReceived = order?.payment_status === "SUCCESS";
  const orderCancelled = order?.order_status === "CANCELLED";
  const paymentStatusLabel = order?.payment_status === "SUCCESS"
    ? "Paid"
    : order?.payment_status === "FAILED"
      ? "Payment failed"
      : order?.payment_status === "CANCELLED"
        ? "Payment cancelled"
        : "Payment pending";

  return (
    <StorefrontShell>
      <main className="page-shell">
        <div className="page-hero compact">
          <div>
            <p className="eyebrow">Order status</p>
            <h1>
              {!order
                ? "Order status unavailable"
                : orderCancelled
                  ? "Order cancelled"
                  : paymentReceived
                    ? "Payment received"
                    : "Order received"}
            </h1>
          </div>
        </div>

        <div className="confirmation-layout">
          <div className="confirmation-content">
            <div className="confirmation-icon">
              {paymentReceived ? <Check size={48} /> : <AlertCircle size={48} />}
            </div>
            <h2>{order ? getOrderStatusLabel(order.order_status) : "Order status unavailable"}</h2>
            <p>
              {order
                ? orderCancelled
                  ? "This order was cancelled. If you have questions about a payment, contact Dantown before placing another order."
                  : paymentReceived
                    ? "Your payment has been confirmed. You can follow the order status as it is prepared."
                    : "Your order has been received, but payment is still pending. No payment has been taken, and the order will not be processed until payment is confirmed."
                : "We could not find an order for this link. Check the order number or contact Dantown for help."}
            </p>

            {order && <div className="confirmation-details">
              <div className="detail-item">
                <span>Order number</span>
                <strong>{order.order_number}</strong>
              </div>
              <div className="detail-item">
                <span>Payment status</span>
                <strong>{paymentStatusLabel}</strong>
              </div>
              <div className="detail-item">
                <span>Subtotal</span>
                <strong>{formatCurrency(Number(order.subtotal))}</strong>
              </div>
              <div className="detail-item">
                <span>VAT</span>
                <strong>{formatCurrency(Number(order.vat))}</strong>
              </div>
              <div className="detail-item">
                <span>Delivery</span>
                <strong>{formatCurrency(Number(order.delivery_fee))}</strong>
              </div>
              <div className="detail-item">
                <span>Total</span>
                <strong>{formatCurrency(Number(order.total))}</strong>
              </div>
            </div>}

            {order && !orderCancelled && <div className="confirmation-next-steps">
              <h3>What&apos;s next</h3>
              <ul>
                <li>Save the order number above for reference.</li>
                {!paymentReceived && <li>Contact Dantown to arrange payment; do not place the same order again.</li>}
                <li>Your order can be prepared after payment is confirmed.</li>
              </ul>
            </div>}

            <div className="confirmation-actions">
              <Link href="/shop" className="button button-primary">
                Continue shopping
              </Link>
              <Link href="/" className="button button-secondary">
                Back home
              </Link>
            </div>
          </div>

          <aside className="confirmation-sidebar">
            <h3>Questions</h3>
            <p>Contact us at :</p>
            <div className="contact-info">
              <p>
                <strong>Dantown Electrical</strong>
              </p>
              <p>Kitale, Kenya</p>
              <p>Phone : +254 (0)...</p>
              <p>Email : info@dantown.co.ke</p>
            </div>
          </aside>
        </div>
      </main>
    </StorefrontShell>
  );
}