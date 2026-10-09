import Link from "next/link";
import { ArrowLeft, Check, Circle } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAuthenticated } from "../../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { StorefrontShell } from "@/components/storefront";
import { buildOrderLifecycleTimeline, getOrderStatusLabel } from "@/lib/order-lifecycle";
import { buildDeliveryStatusSummary } from "@/lib/delivery-status";
import { OrderManagementActions } from "@/components/order-management-actions";
import { DeliveryProofSubmission } from "@/components/account/delivery-proof-submission";
import { getOrderEditExpiryLabel, isOrderModifiable } from "@/lib/order-edit-window";

export const dynamic = "force-dynamic";

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireAuthenticated();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: customer } = await supabase.from("customers").select("id").eq("user_id", context.userId).maybeSingle();
  if (!customer) notFound();

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, subtotal, discount, vat, delivery_fee, total, order_status, payment_status, shipping_address, billing_address, notes, delivery_method, delivery_carrier, delivery_tracking_reference, delivered_at, delivery_proof_path, delivery_confirmed_at, created_at")
    .eq("id", id)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: items }, { data: payments }, { data: history, error: historyError }] = await Promise.all([
    supabase.from("order_items").select("id, product_name_snapshot, sku_snapshot, unit_price, quantity, line_total").eq("order_id", order.id),
    supabase.from("payments").select("method, status, amount, currency, created_at").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("order_status_history").select("previous_status,new_status,note,created_at").eq("order_id", order.id).order("created_at", { ascending: true })
  ]);
  if (historyError) throw new Error(`Unable to load order status history: ${historyError.message}`);
  const address = order.shipping_address && typeof order.shipping_address === "object" ? order.shipping_address as Record<string, unknown> : null;
  const deliverySummary = buildDeliveryStatusSummary({
    status: order.order_status,
    tracking_reference: order.delivery_tracking_reference,
    scheduled_at: undefined,
    delivered_at: order.delivered_at,
    address
  });
  let deliveryProofUrl: string | null = null;
  if (order.delivery_proof_path) {
    const { data, error: proofUrlError } = await createSupabaseServiceClient()
      .storage.from("delivery-proofs").createSignedUrl(order.delivery_proof_path, 300);
    if (proofUrlError) throw new Error(`Unable to load delivery proof: ${proofUrlError.message}`);
    deliveryProofUrl = data.signedUrl;
  }
  const fulfillmentType = String(order.notes ?? "").toLowerCase().includes("pickup") ? "pickup" : "delivery";
  const stages = buildOrderLifecycleTimeline(order.order_status, fulfillmentType);
  const canModifyOrder = isOrderModifiable(order.order_status, order.created_at);
  const expiryLabel = getOrderEditExpiryLabel(order.created_at);

  return (
    <StorefrontShell>
      <main className="page-shell order-detail-page">
        <Link className="back-link" href="/account/orders"><ArrowLeft size={17} /> Back to purchases</Link>
        <div className="order-detail-heading">
          <div><p className="eyebrow">My purchases</p><h1>{order.order_number}</h1><p>Placed {new Date(order.created_at).toLocaleString("en-KE")}</p></div>
          <span className="order-status-badge">{getOrderStatusLabel(order.order_status)}</span>
        </div>
        <div className="order-edit-window-banner" style={{ marginBottom: 16 }}>
          {canModifyOrder ? `This order can still be adjusted until ${expiryLabel}.` : "This order is past the editing window and can no longer be modified."}
        </div>
        <OrderManagementActions orderId={order.id} orderStatus={order.order_status} createdAt={order.created_at} />
        <section className="order-timeline">
          {stages.map((stage) => {
            const complete = stage.complete;
            return <div className={complete ? "order-stage complete" : "order-stage"} key={stage.stage}><span>{complete ? <Check size={15} /> : <Circle size={11} />}</span><small>{stage.label}</small></div>;
          })}
        </section>
        <div className="order-detail-grid">
          <section className="content-panel">
            <div className="account-section-heading"><div><p className="eyebrow">Purchased products</p><h2>Order items</h2></div></div>
            <div className="order-items-list">{(items ?? []).map((item) => <div className="order-item-row" key={item.id}><div><strong>{item.product_name_snapshot}</strong><small>SKU {item.sku_snapshot} · Quantity {item.quantity}</small></div><strong>KSh {Number(item.line_total).toLocaleString("en-KE")}</strong></div>)}</div>
          </section>
          <aside className="content-panel order-summary-panel">
            <p className="eyebrow">Order summary</p>
            <div><span>Subtotal</span><strong>KSh {Number(order.subtotal).toLocaleString("en-KE")}</strong></div>
            <div><span>Discount</span><strong>KSh {Number(order.discount).toLocaleString("en-KE")}</strong></div>
            <div><span>VAT</span><strong>KSh {Number(order.vat).toLocaleString("en-KE")}</strong></div>
            <div><span>Delivery</span><strong>KSh {Number(order.delivery_fee).toLocaleString("en-KE")}</strong></div>
            <div className="order-total"><span>Total</span><strong>KSh {Number(order.total).toLocaleString("en-KE")}</strong></div>
            <p className="order-payment">Payment: {payments?.[0] ? `${payments[0].method} · ${payments[0].status}` : order.payment_status}</p>
            <div className="delivery-status-summary" style={{ marginTop: 18, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 12 }}>
              <p className="eyebrow">{fulfillmentType === "pickup" ? "Pickup status" : "Delivery status"}</p>
              <strong>{deliverySummary.label}</strong>
              <small>Tracking: {deliverySummary.tracking}</small>
              {order.delivery_method && <small>Transport: {order.delivery_method}</small>}
              {order.delivery_carrier && <small>Carrier / driver: {order.delivery_carrier}</small>}
              <small>{deliverySummary.window}</small>
              <small>{deliverySummary.proof}</small>
              {order.delivery_confirmed_at && <small>Customer confirmed: {new Date(order.delivery_confirmed_at).toLocaleString("en-KE")}</small>}
              {deliveryProofUrl && <a href={deliveryProofUrl} target="_blank" rel="noreferrer">View submitted proof</a>}
            </div>
            {order.order_status === "DELIVERED" && (
              <DeliveryProofSubmission orderId={order.id} proofRecorded={Boolean(order.delivery_confirmed_at && order.delivery_proof_path)} />
            )}
            {address && fulfillmentType === "delivery" && <p className="order-address">Delivery address<br />{String(address.name ?? "")}<br />{String(address.address_line_1 ?? address.address ?? "")}<br />{String(address.city ?? address.town ?? "")}</p>}
          </aside>
        </div>
        {history?.length ? (
          <section className="content-panel order-history-panel">
            <p className="eyebrow">Order updates</p>
            <h2>Status history</h2>
            {history.map((entry) => (
              <div className="order-history-row" key={`${entry.created_at}-${entry.new_status}`}>
                <span>{new Date(entry.created_at).toLocaleString("en-KE")}</span>
                <strong>{getOrderStatusLabel(entry.new_status)}</strong>
                {entry.note && <span>{entry.note}</span>}
              </div>
            ))}
          </section>
        ) : null}
      </main>
    </StorefrontShell>
  );
}
