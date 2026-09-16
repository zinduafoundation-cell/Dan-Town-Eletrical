import { requireAuthorizedPermission } from "../../../lib/auth/server";
import { createSupabaseServiceClient } from "../../../lib/supabase/server";
import { PortalShell } from "../../portal-shell";
import { PurchaseWorkspace } from "@/components/admin/purchase-workspace";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const context = await requireAuthorizedPermission("inventory.read");
  const supabase = createSupabaseServiceClient();
  const [{ data: suppliers }, { data: warehouses }, { data: products }, { data: orders }] = await Promise.all([
    supabase.from("suppliers").select("id,company_name").eq("status", "ACTIVE").order("company_name"),
    supabase.from("warehouses").select("id,name").eq("is_active", true).order("name"),
    supabase.from("products").select("id,name").eq("status", "ACTIVE").order("name").limit(500),
    supabase.from("purchase_orders").select("order_number,status,total,created_at").order("created_at", { ascending: false }).limit(20)
  ]);
  return <PortalShell title="Purchases." description="Create purchase drafts and keep receiving separate from stock mutation." roles={context.roles} permissions={context.permissions} links={[{ label: "Overview", href: "/admin" }, { label: "Purchases", href: "/admin/purchases" }, { label: "Inventory", href: "/admin/inventory", permission: "inventory.read" }, { label: "Suppliers", href: "/admin/suppliers", permission: "products.read" }]}>
    <PurchaseWorkspace suppliers={(suppliers ?? []).map((item) => ({ id: item.id, name: item.company_name }))} warehouses={warehouses ?? []} products={products ?? []} />
    <section className="portal-card purchase-list"><h2>Recent purchase drafts</h2>{orders?.length ? <table><thead><tr><th>Order</th><th>Status</th><th>Total</th><th>Created</th></tr></thead><tbody>{orders.map((order) => <tr key={order.order_number}><td>{order.order_number}</td><td>{order.status}</td><td>KSh {Number(order.total).toLocaleString()}</td><td>{new Date(order.created_at).toLocaleDateString()}</td></tr>)}</tbody></table> : <p>No purchase orders yet.</p>}</section>
  </PortalShell>;
}
