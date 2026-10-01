import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";
import { StorefrontShell } from "@/components/storefront";
import { requireAuthenticated } from "../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const context = await requireAuthenticated();
  const supabase = await createSupabaseServerClient();
  const { data: customer } = await supabase.from("customers").select("id").eq("user_id", context.userId).maybeSingle();
  const { data: orders } = customer ? await supabase.from("orders").select("id, order_number, total, payment_status, created_at").eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(25) : { data: [] };
  const orderIds = (orders ?? []).map((order) => order.id);
  const { data: payments } = orderIds.length ? await supabase.from("payments").select("order_id, method, status, amount, currency, created_at").in("order_id", orderIds).order("created_at", { ascending: false }) : { data: [] };
  const orderMap = new Map((orders ?? []).map((order) => [order.id, order]));

  return <StorefrontShell><main className="page-shell account-subpage"><Link className="back-link" href="/account"><ArrowLeft size={17} /> Back to My Dantown Hub</Link><section className="account-subpage-card account-data-card"><span className="account-subpage-icon"><CreditCard size={26} /></span><p className="eyebrow">My Dantown Hub</p><h1>Payment history</h1><p>Payment methods are selected securely during checkout. This page shows payment activity for your orders only.</p>{payments?.length ? <div className="payment-history-list">{payments.map((payment) => { const order = orderMap.get(payment.order_id); return <div className="payment-history-row" key={`${payment.order_id}-${payment.created_at}`}><div><strong>{order?.order_number || "Dantown order"}</strong><small>{payment.method} · {new Date(payment.created_at).toLocaleDateString("en-KE")}</small></div><div><strong>{payment.currency || "KES"} {Number(payment.amount).toLocaleString("en-KE")}</strong><small>{payment.status}</small></div></div>; })}</div> : <div className="empty-state"><h3>No payment history yet.</h3><p>Payment activity will appear after you place an order.</p><Link className="button button-primary" href="/shop">Start shopping</Link></div>}</section></main></StorefrontShell>;
}
