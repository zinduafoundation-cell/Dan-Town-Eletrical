import Link from "next/link";
import { ArrowLeft, Check, Circle } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAuthenticated } from "../../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { StorefrontShell } from "@/components/storefront";

export const dynamic = "force-dynamic";

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireAuthenticated();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: customer } = await supabase.from("customers").select("id").eq("user_id", context.userId).maybeSingle();
  if (!customer) notFound();

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, subtotal, discount, vat, delivery_fee, total, order_status, payment_status, shipping_address, billing_address, created_at")
    .eq("id", id)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: items }, { data: payments }] = await Promise.all([
    supabase.from("order_items").select("id, product_name_snapshot, sku_snapshot, unit_price, quantity, line_total").eq("order_id", order.id),
    supabase.from("payments").select("method, status, amount, currency, created_at").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1)
  ]);
  const address = order.shipping_address && typeof order.shipping_address === "object" ? order.shipping_address as Record<string, unknown> : null;
  const stages = ["PENDING", "PROCESSING", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY", "DELIVERED"];
  const currentIndex = stages.indexOf(order.order_status);

  return (
    <StorefrontShell>
      <main className="page-shell order-detail-page">
        <Link className="back-link" href="/account/orders"><ArrowLeft size={17} /> Back to purchases</Link>
        <div className="order-detail-heading">
          <div><p className="eyebrow">My purchases</p><h1>{order.order_number}</h1><p>Placed {new Date(order.created_at).toLocaleString("en-KE")}</p></div>
          <span className="order-status-badge">{order.order_status.replaceAll("_", " ")}</span>
        </div>
        <section className="order-timeline">
          {stages.map((stage, index) => {
            const complete = currentIndex >= index && currentIndex >= 0;
            return <div className={complete ? "order-stage complete" : "order-stage"} key={stage}><span>{complete ? <Check size={15} /> : <Circle size={11} />}</span><small>{stage.replaceAll("_", " ")}</small></div>;
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
            {address && <p className="order-address">Delivery address<br />{String(address.name ?? "")}<br />{String(address.address_line_1 ?? address.address ?? "")}<br />{String(address.city ?? address.town ?? "")}</p>}
          </aside>
        </div>
      </main>
    </StorefrontShell>
  );
}
