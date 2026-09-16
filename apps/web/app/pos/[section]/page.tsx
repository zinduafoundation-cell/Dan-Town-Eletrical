import { notFound } from "next/navigation";
import { requireAuthorizedPermission } from "../../../lib/auth/server";
import { createSupabaseServiceClient } from "../../../lib/supabase/server";
import { RefundSaleButton } from "@/components/pos/refund-sale-button";

const sections = {
  "sales-history": { title: "Sales History", description: "Review completed sales and payment status.", permission: "orders.read" as const },
  customers: { title: "Customers", description: "Find customer records and purchase context.", permission: "customers.read" as const },
  inventory: { title: "Inventory", description: "Monitor available stock and reorder thresholds.", permission: "inventory.read" as const },
  cash: { title: "Cash Management", description: "Track today’s tender totals and cash position.", permission: "orders.read" as const },
  reports: { title: "Reports", description: "Review today’s operating performance.", permission: "reports.read" as const },
  settings: { title: "POS Settings", description: "Review this register’s operating configuration.", permission: "orders.read" as const }
};

export const dynamic = "force-dynamic";

export default async function POSSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const config = sections[section as keyof typeof sections];
  if (!config) notFound();
  const context = await requireAuthorizedPermission(config.permission);
  const supabase = createSupabaseServiceClient();

  if (section === "customers") {
    const { data } = await supabase.from("customers").select("id, name, phone, email, customer_type, status").order("name").limit(100);
    return <POSDataPage title={config.title} description={config.description}><div className="pos-data-list">{data?.length ? data.map((customer) => <div className="pos-data-row" key={customer.id}><strong>{customer.name}</strong><span>{customer.phone || customer.email || "No contact"} · {customer.customer_type}</span></div>) : <p>No customers found.</p>}</div></POSDataPage>;
  }

  if (section === "inventory") {
    const { data } = await supabase.from("inventory").select("id, quantity, reserved_quantity, reorder_level, products(name, sku)").order("quantity").limit(100);
    return <POSDataPage title={config.title} description={config.description}><div className="pos-data-list">{data?.length ? data.map((row) => { const product = Array.isArray(row.products) ? row.products[0] : row.products; const available = Number(row.quantity || 0) - Number(row.reserved_quantity || 0); return <div className="pos-data-row" key={row.id}><strong>{product?.name || "Product"}</strong><span>{product?.sku || ""} · {available} available · reorder at {row.reorder_level}</span></div>; }) : <p>No inventory found.</p>}</div></POSDataPage>;
  }

  if (section === "settings") {
    return <POSDataPage title={config.title} description={config.description}><div className="pos-data-list"><div className="pos-data-row"><strong>Register mode</strong><span>Online with offline sale queue enabled</span></div><div className="pos-data-row"><strong>Receipt currency</strong><span>Kenyan Shilling (KSh)</span></div><div className="pos-data-row"><strong>Supported tenders</strong><span>Cash · Card · M-Pesa · Paystack</span></div></div></POSDataPage>;
  }

  if (section === "cash") {
    const { data: payments } = await supabase.from("payments").select("amount, method, status").eq("status", "SUCCESS").gte("created_at", new Date().toISOString().slice(0, 10));
    const totals = (payments ?? []).reduce<Record<string, number>>((summary, payment) => {
      summary[payment.method] = (summary[payment.method] ?? 0) + Number(payment.amount || 0);
      return summary;
    }, {});
    return <POSDataPage title={config.title} description={config.description}><div className="pos-data-list">{Object.entries(totals).length ? Object.entries(totals).map(([method, total]) => <div className="pos-data-row" key={method}><strong>{method}</strong><span>KSh {Math.round(total).toLocaleString()}</span></div>) : <p>No successful payments recorded today.</p>}</div></POSDataPage>;
  }

  const { data: orders } = await supabase.from("orders").select("id, order_number, total, payment_status, order_status, created_at").order("created_at", { ascending: false }).limit(100);
  return <POSDataPage title={config.title} description={config.description}><div className="pos-data-list">{orders?.length ? orders.map((order) => <div className="pos-data-row" key={order.id}><div><strong>{order.order_number}</strong><span>KSh {Number(order.total).toLocaleString()} · {order.payment_status} · {order.order_status}</span></div>{section === "sales-history" && context.permissions.includes("refunds.request") && <RefundSaleButton orderId={order.id} orderNumber={order.order_number} total={Number(order.total)} />}</div>) : <p>No sales recorded yet.</p>}</div></POSDataPage>;
}

function POSDataPage({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="pos-data-page"><div className="pos-dashboard-header"><h1>{title}</h1><p>{description}</p></div><section className="pos-dashboard-section">{children}</section></div>;
}