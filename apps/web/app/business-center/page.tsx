import Link from "next/link";
import { AlertTriangle, ArrowRight, Boxes, CircleDollarSign, ClipboardList, CreditCard, Gauge, PackageX, Users, WalletCards } from "lucide-react";
import { hasPermission } from "@dantown/auth";
import type { Permission } from "@dantown/shared";
import { getAuthorizationContext } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { PortalShell } from "@/app/portal-shell";
import { redirect } from "next/navigation";
import { SharedAIPanel } from "@/components/ai/shared-ai-panel";

export const dynamic = "force-dynamic";

const centreLinks = [
  { label: "Overview", href: "/business-center" },
  { label: "Orders", href: "/admin/orders", permission: "orders.read" as Permission },
  { label: "Sales", href: "/admin/reports", permission: "reports.read" as Permission },
  { label: "POS Monitor", href: "/pos", permission: "orders.read" as Permission },
  { label: "Products", href: "/admin/products", permission: "products.read" as Permission },
  { label: "Inventory", href: "/admin/inventory", permission: "inventory.read" as Permission },
  { label: "Payments", href: "/admin/payments", permission: "payments.read" as Permission },
  { label: "Customers", href: "/admin/customers", permission: "customers.read" as Permission },
  { label: "Team", href: "/admin/team", permission: "users.read" as Permission },
  { label: "Automation", href: "/admin/automation", permission: "automation.read" as Permission }
  ,{ label: "AI Knowledge", href: "/admin/knowledge", permission: "settings.manage" as Permission }
];

export default async function BusinessCenterPage() {
  const context = await getAuthorizationContext();
  const authorized = context && (context.userId === "dev-bypass-user" || ["orders.read", "inventory.read", "users.read", "reports.read"].some((permission) => hasPermission(context, permission as Permission)));
  if (!authorized) redirect("/403");

  const supabase = createSupabaseServiceClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [{ data: orders }, { data: ordersToday }, { count: productCount }, { count: customerCount }, { data: inventory }, { data: payments }, { data: sessions }, { data: syncRecords, error: offlineSyncError }] = await Promise.all([
    supabase.from("orders").select("id, order_number, total, payment_status, order_status, sales_channel, created_at").order("created_at", { ascending: false }).limit(8),
    supabase.from("orders").select("id, total, payment_status, order_status, sales_channel").gte("created_at", start.toISOString()),
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("inventory").select("quantity, reserved_quantity, reorder_level"),
    supabase.from("payments").select("amount, status, created_at").gte("created_at", start.toISOString()),
    supabase.from("pos_sessions").select("id, employee_id, opened_at").eq("status", "OPEN"),
    supabase.from("pos_sync_records").select("transaction_id, device_id, status, retry_count, error_message, synced_at")
  ]);

  const successfulToday = (payments ?? []).filter((payment) => payment.status === "SUCCESS");
  const revenueToday = successfulToday.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const paidToday = (ordersToday ?? []).filter((order) => order.payment_status === "SUCCESS");
  const posSalesToday = paidToday.filter((order) => order.sales_channel === "POS").reduce((sum, order) => sum + Number(order.total || 0), 0);
  const onlineSalesToday = paidToday.filter((order) => order.sales_channel === "ONLINE").reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pendingOrders = (ordersToday ?? []).filter((order) => ["PENDING", "PAYMENT_PENDING", "PROCESSING"].includes(order.order_status)).length;
  const pendingPayments = (ordersToday ?? []).filter((order) => ["PENDING", "PROCESSING"].includes(order.payment_status)).length;
  const lowStock = (inventory ?? []).filter((row) => Number(row.quantity || 0) - Number(row.reserved_quantity || 0) <= Number(row.reorder_level || 0)).length;
  const outOfStock = (inventory ?? []).filter((row) => Number(row.quantity || 0) - Number(row.reserved_quantity || 0) <= 0).length;
  const posTransactions = paidToday.filter((order) => order.sales_channel === "POS").length;
  const posOrders = (orders ?? []).filter((order) => order.sales_channel === "POS");
  const pendingSync = (syncRecords ?? []).filter((record) => ["PENDING", "SYNCING"].includes(record.status)).length;
  const failedSync = (syncRecords ?? []).filter((record) => record.status === "FAILED").length;
  const conflictSync = (syncRecords ?? []).filter((record) => record.status === "CONFLICT").length;

  return <PortalShell title="Dantown Centre" description="One live view of orders, revenue, inventory, customers, and operations." roles={context!.roles} permissions={context!.permissions} links={centreLinks}>
    <div className="centre-dashboard">
      <div className="centre-metrics">
        <Metric icon={CircleDollarSign} label="Revenue today" value={`KSh ${Math.round(revenueToday).toLocaleString()}`} />
        <Metric icon={WalletCards} label="POS sales today" value={`KSh ${Math.round(posSalesToday).toLocaleString()}`} />
        <Metric icon={CreditCard} label="Online sales today" value={`KSh ${Math.round(onlineSalesToday).toLocaleString()}`} />
        <Metric icon={ClipboardList} label="Orders today" value={String(ordersToday?.length ?? 0)} />
        <Metric icon={ClipboardList} label="Pending orders" value={String(pendingOrders)} />
        <Metric icon={CreditCard} label="Pending payments" value={String(pendingPayments)} alert={pendingPayments > 0} />
        <Metric icon={AlertTriangle} label="Low stock lines" value={String(lowStock)} alert={lowStock > 0} />
        <Metric icon={PackageX} label="Out of stock" value={String(outOfStock)} alert={outOfStock > 0} />
        <Metric icon={Boxes} label="Products" value={String(productCount ?? 0)} />
        <Metric icon={Users} label="Customers" value={String(customerCount ?? 0)} />
        <Metric icon={Gauge} label="Active POS sessions" value={String(sessions?.length ?? 0)} />
        <Metric icon={WalletCards} label="POS transactions" value={String(posTransactions)} />
      </div>
      <div className="centre-panels">
        <section className="portal-card centre-panel"><div className="centre-panel-heading"><div><p className="eyebrow">Unified operations</p><h2>Recent orders</h2></div><Link className="text-link" href="/admin/orders">Open orders <ArrowRight size={15} /></Link></div>{orders?.length ? <div className="centre-order-list">{orders.map((order) => <div className="centre-order-row" key={order.id}><div><strong>{order.order_number}</strong><small>{order.sales_channel} · {new Date(order.created_at).toLocaleString()}</small></div><div><strong>KSh {Number(order.total).toLocaleString()}</strong><small>{order.payment_status} · {order.order_status}</small></div></div>)}</div> : <p>No orders have been recorded yet.</p>}</section>
        <section className="portal-card centre-panel"><p className="eyebrow">Action queue</p><h2>Keep the business moving.</h2><div className="centre-action-list"><Link href="/pos/new-sale"><span>Open POS</span><ArrowRight size={15} /></Link><Link href="/admin/orders"><span>Review {pendingOrders} pending orders</span><ArrowRight size={15} /></Link><Link href="/admin/inventory"><span>Review {lowStock} low-stock lines</span><ArrowRight size={15} /></Link><Link href="/admin/payments"><span>Review {pendingPayments} pending payments</span><ArrowRight size={15} /></Link></div><div style={{ marginTop: 16 }}><SharedAIPanel title="Dan T AI Business Assistant" subtitle="Daily summary, alerts, and operational recommendations" surface="centre" suggestions={["What needs my attention today?", "Today's summary", "Low stock alerts"]} compact /></div></section>
      </div>
      <div className="centre-panels">
        <section className="portal-card centre-panel"><div className="centre-panel-heading"><div><p className="eyebrow">Sales floor</p><h2>POS monitor</h2></div><Link className="text-link" href="/pos">Open POS <ArrowRight size={15} /></Link></div><div className="centre-status-grid"><Status label="Open cashier sessions" value={String(sessions?.length ?? 0)} /><Status label="Transactions today" value={String(posTransactions)} /><Status label="POS sales today" value={`KSh ${Math.round(posSalesToday).toLocaleString()}`} /></div>{posOrders.length ? <p className="centre-note">Latest POS sale: {posOrders[0].order_number} at {new Date(posOrders[0].created_at).toLocaleTimeString()}</p> : <p className="centre-note">No POS sales have been recorded today.</p>}</section>
        <section className="portal-card centre-panel"><p className="eyebrow">Sync health</p><h2>Offline queue</h2>{offlineSyncError ? <div className="centre-unconfigured"><strong>Server sync tracking requires migration 031</strong><p>Local POS queueing is available, but Centre monitoring becomes live after the offline sync migration is deployed.</p></div> : <div className="centre-status-grid"><Status label="Pending sync" value={String(pendingSync)} /><Status label="Failed sync" value={String(failedSync)} /><Status label="Conflicts" value={String(conflictSync)} /></div>}</section>
      </div>
    </div>
  </PortalShell>;
}

function Metric({ icon: Icon, label, value, alert = false }: { icon: typeof CircleDollarSign; label: string; value: string; alert?: boolean }) {
  return <article className={`centre-metric${alert ? " is-alert" : ""}`}><span className="centre-metric-icon"><Icon size={19} /></span><div><small>{label}</small><strong>{value}</strong></div></article>;
}

function Status({ label, value }: { label: string; value: string }) {
  return <div className="centre-status"><small>{label}</small><strong>{value}</strong></div>;
}
