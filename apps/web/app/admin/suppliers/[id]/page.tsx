import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthorizedPermission } from "../../../../lib/auth/server";
import { createSupabaseServiceClient } from "../../../../lib/supabase/server";
import { PortalShell } from "../../../portal-shell";

export const dynamic = "force-dynamic";

export default async function SupplierProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireAuthorizedPermission("products.read");
  const { id } = await params;
  const supabase = createSupabaseServiceClient();
  const [{ data: supplier }, { data: supplierProducts }, { data: purchases }] = await Promise.all([
    supabase.from("suppliers").select("id,company_name,contact_name,phone,email,address,tax_number,payment_terms,status,created_at").eq("id", id).maybeSingle(),
    supabase.from("supplier_products").select("product_id,supplier_sku,unit_cost,lead_time_days").eq("supplier_id", id),
    supabase.from("purchase_orders").select("order_number,status,total,created_at").eq("supplier_id", id).order("created_at", { ascending: false }).limit(20)
  ]);
  if (!supplier) notFound();
  return <PortalShell title={supplier.company_name} description="Supplier relationship, product coverage, and purchasing history from the shared procurement records." roles={context.roles} permissions={context.permissions} links={[{ label: "Suppliers", href: "/admin/suppliers" }, { label: "Purchases", href: "/admin/purchases", permission: "inventory.read" }, { label: "Centre", href: "/admin" }]}>
    <div className="supplier-profile-summary"><div><small>Status</small><strong>{supplier.status}</strong></div><div><small>Contact</small><strong>{supplier.contact_name || "Not provided"}</strong></div><div><small>Phone</small><strong>{supplier.phone || "Not provided"}</strong></div><div><small>Email</small><strong>{supplier.email || "Not provided"}</strong></div><div><small>Payment terms</small><strong>{supplier.payment_terms || "Not provided"}</strong></div></div>
    <section className="portal-card supplier-profile-section"><h2>Products supplied</h2>{supplierProducts?.length ? <table><thead><tr><th>Product ID</th><th>Supplier SKU</th><th>Unit cost</th><th>Lead time</th></tr></thead><tbody>{supplierProducts.map((item) => <tr key={item.product_id}><td>{item.product_id}</td><td>{item.supplier_sku || "-"}</td><td>KSh {Number(item.unit_cost).toLocaleString()}</td><td>{item.lead_time_days ?? "-"} days</td></tr>)}</tbody></table> : <p>No linked supplier products yet.</p>}</section>
    <section className="portal-card supplier-profile-section"><h2>Purchase history</h2>{purchases?.length ? <table><thead><tr><th>Order</th><th>Status</th><th>Total</th><th>Date</th></tr></thead><tbody>{purchases.map((order) => <tr key={order.order_number}><td>{order.order_number}</td><td>{order.status}</td><td>KSh {Number(order.total).toLocaleString()}</td><td>{new Date(order.created_at).toLocaleDateString()}</td></tr>)}</tbody></table> : <p>No purchases recorded for this supplier.</p>}</section>
    <Link className="button button-primary" href="/admin/purchases">Create purchase draft</Link>
  </PortalShell>;
}
