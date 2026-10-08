import Link from "next/link";
import { AlertTriangle, ArrowRight, Boxes, CircleDollarSign, ClipboardList, CreditCard, Gauge, PackageX, Users, WalletCards } from "lucide-react";
import { hasPermission } from "@dantown/auth";
import type { Permission } from "@dantown/shared";
import { getAuthorizationContext, isBskAccount } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { PortalShell } from "@/app/portal-shell";
import { redirect } from "next/navigation";
import { SharedAIPanel } from "@/components/ai/shared-ai-panel";
import { CommandCentreBar } from "@/components/centre/command-centre-bar";
import { getCentreMetrics } from "@/lib/centre/metrics";
import { getReorderList, getStaffActivityToday } from "@/lib/centre/insights";
import { ReorderPanel, StaffActivityPanel } from "@/components/centre/insight-panels";
import { BiometricSettings } from "@/components/auth/biometric-settings";

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
  const bskAccount = await isBskAccount();
  const authorized = context && (bskAccount || context.userId === "dev-bypass-user" || ["orders.read", "inventory.read", "users.read", "reports.read"].some((permission) => hasPermission(context, permission as Permission)));
  if (!authorized) redirect("/403");

  const supabase = createSupabaseServiceClient();
  const [{ data: orders }, { data: deletedOrders }, centreMetrics] = await Promise.all([
    hasPermission(context, "orders.read")
      ? supabase.from("orders").select("id, order_number, total, payment_status, order_status, sales_channel, created_at").order("created_at", { ascending: false }).limit(8)
      : Promise.resolve({ data: [] }),
    supabase.from("audit_logs").select("id, action, resource_id, created_at, new_data").in("action", ["ORDER_DELETED", "ORDER_DELETED_BY_ADMIN", "ORDER_AUTO_DELETED"]).order("created_at", { ascending: false }).limit(6),
    getCentreMetrics(context.permissions),
  ]);
  const { metrics, syncTrackingAvailable, source } = centreMetrics;
  const [staffActivity, reorderLines] = await Promise.all([
    hasPermission(context, "users.read") ? getStaffActivityToday().catch(() => []) : Promise.resolve(null),
    hasPermission(context, "inventory.read") ? getReorderList().catch(() => []) : Promise.resolve(null),
  ]);
  const posOrders = (orders ?? []).filter((order) => order.sales_channel === "POS");
  const deletedOrderArchive = (deletedOrders ?? []).map((entry) => {
    const payload = ((entry.new_data as Record<string, unknown>) ?? {}) as Record<string, unknown>;
    return {
      id: entry.id,
      orderNumber: String(payload.order_number ?? "Unknown order"),
      deletedAt: String(payload.deleted_at ?? entry.created_at ?? ""),
      reason: String(payload.reason ?? entry.action ?? "Deleted"),
      deletedByRole: String(payload.deleted_by_role ?? "system"),
    };
  });

  return <PortalShell title="Dantown Centre" description="One live view of orders, revenue, inventory, customers, and operations." roles={context!.roles} permissions={context!.permissions} links={centreLinks}>
    <div className="centre-dashboard">
      <CommandCentreBar />
      <div className="centre-metrics">
        <Metric icon={CircleDollarSign} label="Revenue today" value={`KSh ${Math.round(metrics.revenueToday).toLocaleString()}`} />
        <Metric icon={WalletCards} label="POS sales today" value={`KSh ${Math.round(metrics.posSalesToday).toLocaleString()}`} />
        <Metric icon={CreditCard} label="Online sales today" value={`KSh ${Math.round(metrics.onlineSalesToday).toLocaleString()}`} />
        <Metric icon={ClipboardList} label="Orders today" value={String(metrics.ordersToday)} />
        <Metric icon={ClipboardList} label="Pending orders" value={String(metrics.pendingOrders)} />
        <Metric icon={CreditCard} label="Pending payments" value={String(metrics.pendingPayments)} alert={metrics.pendingPayments > 0} />
        <Metric icon={AlertTriangle} label="Low stock lines" value={String(metrics.lowStock)} alert={metrics.lowStock > 0} />
        <Metric icon={PackageX} label="Out of stock" value={String(metrics.outOfStock)} alert={metrics.outOfStock > 0} />
        <Metric icon={Boxes} label="Products" value={String(metrics.productCount)} />
        <Metric icon={Users} label="Customers" value={String(metrics.customerCount)} />
        <Metric icon={Gauge} label="Active POS sessions" value={String(metrics.activePosSessions)} />
        <Metric icon={WalletCards} label="POS transactions" value={String(metrics.posTransactions)} />
        <Metric icon={AlertTriangle} label="Event delivery risks" value={String(metrics.retryDomainEvents + metrics.deadLetterDomainEvents)} alert={metrics.retryDomainEvents + metrics.deadLetterDomainEvents > 0} />
      </div>
      <div className="centre-panels">
        <section className="portal-card centre-panel"><div className="centre-panel-heading"><div><p className="eyebrow">Unified operations</p><h2>Recent orders</h2></div><Link className="text-link" href="/admin/orders">Open orders <ArrowRight size={15} /></Link></div>{orders?.length ? <div className="centre-order-list">{orders.map((order) => <div className="centre-order-row" key={order.id}><div><strong>{order.order_number}</strong><small>{order.sales_channel} · {new Date(order.created_at).toLocaleString()}</small></div><div><strong>KSh {Number(order.total).toLocaleString()}</strong><small>{order.payment_status} · {order.order_status}</small></div></div>)}</div> : <p>No orders have been recorded yet.</p>}</section>
        <section className="portal-card centre-panel"><p className="eyebrow">Action queue</p><h2>Keep the business moving.</h2><div className="centre-action-list"><Link href="/pos/new-sale"><span>Open POS</span><ArrowRight size={15} /></Link><Link href="/admin/orders"><span>Review {metrics.pendingOrders} pending orders</span><ArrowRight size={15} /></Link><Link href="/admin/inventory"><span>Review {metrics.lowStock} low-stock lines</span><ArrowRight size={15} /></Link><Link href="/admin/payments"><span>Review {metrics.pendingPayments} pending payments</span><ArrowRight size={15} /></Link></div><div style={{ marginTop: 16 }}><SharedAIPanel title="Dan T AI Business Assistant" subtitle="Daily summary, alerts, and operational recommendations" surface="centre" suggestions={["What needs my attention today?", "Today's summary", "Low stock alerts"]} compact /></div></section>
      </div>
      <div className="centre-panels">
        <section className="portal-card centre-panel"><div className="centre-panel-heading"><div><p className="eyebrow">Order flow</p><h2>Operational status</h2></div><Link className="text-link" href="/pos">Open POS <ArrowRight size={15} /></Link></div><div className="centre-status-grid"><Status label="Done today" value={String(metrics.ordersToday)} /><Status label="Waiting review" value={String(Math.max(metrics.pendingOrders, metrics.pendingPayments))} /><Status label="Online orders" value={String((orders ?? []).filter((order) => order.sales_channel === "ONLINE").length)} /><Status label="POS sales" value={String(posOrders.length)} /></div></section>
        <section className="portal-card centre-panel"><div className="centre-panel-heading"><div><p className="eyebrow">Archive</p><h2>Deleted order bin</h2></div><Link className="text-link" href="/admin/orders">Review queue</Link></div>{deletedOrderArchive.length ? <div className="centre-order-list">{deletedOrderArchive.map((entry) => <div className="centre-order-row" key={entry.id}><div><strong>{entry.orderNumber}</strong><small>{entry.deletedByRole}</small></div><div><strong>{new Date(entry.deletedAt).toLocaleDateString("en-KE")}</strong><small>{entry.reason}</small></div></div>)}</div> : <p>No deleted orders have been archived yet.</p>}</section>
      </div>
      <div className="centre-panels">
        <section className="portal-card centre-panel"><div className="centre-panel-heading"><div><p className="eyebrow">Sales floor</p><h2>POS monitor</h2></div><Link className="text-link" href="/pos">Open POS <ArrowRight size={15} /></Link></div><div className="centre-status-grid"><Status label="Open cashier sessions" value={String(metrics.activePosSessions)} /><Status label="Transactions today" value={String(metrics.posTransactions)} /><Status label="POS sales today" value={`KSh ${Math.round(metrics.posSalesToday).toLocaleString()}`} /></div>{posOrders.length ? <p className="centre-note">Latest POS sale: {posOrders[0].order_number} at {new Date(posOrders[0].created_at).toLocaleTimeString()}</p> : <p className="centre-note">No POS sales have been recorded today.</p>}</section>
        <section className="portal-card centre-panel"><p className="eyebrow">Delivery health</p><h2>Sync and event queue</h2>{!syncTrackingAvailable ? <div className="centre-unconfigured"><strong>Server sync tracking requires migration 031</strong><p>Local POS queueing is available, but Centre monitoring becomes live after the offline sync migration is deployed.</p></div> : <><div className="centre-status-grid"><Status label="Pending sync" value={String(metrics.pendingSync)} /><Status label="Failed sync" value={String(metrics.failedSync)} /><Status label="Conflicts" value={String(metrics.conflictSync)} /></div>{source === "read-model" ? <div className="centre-status-grid" style={{ marginTop: 12 }}><Status label="Waiting delivery" value={String(metrics.pendingDomainEvents)} /><Status label="Retrying events" value={String(metrics.retryDomainEvents)} /><Status label="Dead letters" value={String(metrics.deadLetterDomainEvents)} /></div> : <p className="centre-note">Event delivery monitoring activates after the queued Centre migrations are deployed.</p>}</>}</section>
      </div>
      {(staffActivity || reorderLines) && <div className="centre-panels">
        {staffActivity && <StaffActivityPanel rows={staffActivity} />}
        {reorderLines && <ReorderPanel lines={reorderLines} />}
      </div>}
      <BiometricSettings />
    </div>
  </PortalShell>;
}

function Metric({ icon: Icon, label, value, alert = false }: { icon: typeof CircleDollarSign; label: string; value: string; alert?: boolean }) {
  return <article className={`centre-metric${alert ? " is-alert" : ""}`}><span className="centre-metric-icon"><Icon size={19} /></span><div><small>{label}</small><strong>{value}</strong></div></article>;
}

function Status({ label, value }: { label: string; value: string }) {
  return <div className="centre-status"><small>{label}</small><strong>{value}</strong></div>;
}
