import { requireAuthenticated } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { PortalShell } from "../../portal-shell";
import type { Permission } from "@dantown/shared";

export const dynamic = "force-dynamic";

const labelMap: Record<string, string> = {
  orders: "Orders",
  customers: "Customers",
  quotes: "Quotes",
  inventory: "Inventory"
};

const permissionMap: Record<string, Permission> = {
  orders: "orders.read",
  customers: "customers.read",
  quotes: "quotes.read",
  inventory: "inventory.read"
};

async function getSectionSummary(slug: string) {
  const supabase = createSupabaseServiceClient();

  switch (slug) {
    case "orders": {
      const { count, error } = await supabase.from("orders").select("id", { count: "exact", head: true });
      const { data: recent } = await supabase.from("orders").select("order_number,total,order_status,created_at,processed_by_staff_name,processed_by_staff_role").order("created_at", { ascending: false }).limit(8);
      return { title: labelMap[slug], count: error ? 0 : count ?? 0, detail: "Recent sales and fulfillment records", columns: ["Order", "Total", "Status", "Served by", "Created"], rows: (recent ?? []).map((row) => [row.order_number, `Ksh ${Number(row.total ?? 0).toLocaleString()}`, row.order_status, row.processed_by_staff_name ? `${row.processed_by_staff_name} (${row.processed_by_staff_role ?? "Staff"})` : "Not recorded", new Date(row.created_at).toLocaleDateString()]) };
    }
    case "customers": {
      const { count, error } = await supabase.from("customers").select("id", { count: "exact", head: true });
      const { data: recent } = await supabase.from("customers").select("name,email,customer_type,status,created_at").order("created_at", { ascending: false }).limit(8);
      return { title: labelMap[slug], count: error ? 0 : count ?? 0, detail: "Customer profiles and accounts", columns: ["Name", "Email", "Type", "Status"], rows: (recent ?? []).map((row) => [row.name, row.email ?? "No email", row.customer_type, row.status]) };
    }
    case "quotes": {
      const { data: recent } = await supabase.from("quotations").select("quote_number,status").limit(8);
      return { title: labelMap[slug], count: recent?.length ?? 0, detail: "Quote workflow is available for review", columns: ["Quote", "Status"], rows: (recent ?? []).map((row) => [row.quote_number, row.status]) };
    }
    case "inventory": {
      const { data, error } = await supabase.from("inventory").select("quantity");
      const total = (data ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
      const { data: recent } = await supabase.from("inventory").select("product_id,quantity,reorder_level").limit(8);
      return { title: labelMap[slug], count: error ? 0 : total, detail: "Live stock visibility", columns: ["Product", "Quantity", "Reorder level"], rows: (recent ?? []).map((row) => [row.product_id, String(row.quantity), String(row.reorder_level)]) };
    }
    default:
      return { title: labelMap[slug] ?? "Workspace", count: 0, detail: "Section summary", columns: [], rows: [] };
  }
}

export default async function StaffSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const route = slug ?? "orders";
  const context = await requireAuthenticated();
  const requiredPermission = permissionMap[route] ?? "orders.read";
  if (!context.permissions.includes(requiredPermission) && !context.roles.includes("ADMIN") && !context.roles.includes("CEO")) {
    return <PortalShell title="Access required" description="Your account does not have access to this workspace." roles={context.roles} permissions={context.permissions} links={[{ label: "Dashboard", href: "/staff" }]}><div className="portal-card"><strong>Permission required: {requiredPermission}</strong></div></PortalShell>;
  }
  const summary = await getSectionSummary(route);
  const title = labelMap[route] ?? route.replace(/-/g, " ");

  return (
    <PortalShell
      title={`${title} workspace`}
      description={`Operational overview for ${title.toLowerCase()} in the business center.`}
      roles={context.roles}
      permissions={context.permissions}
      links={[
        { label: "Dashboard", href: "/staff" },
        { label: "POS", href: "/pos", permission: "orders.create" },
        { label: "Orders", href: "/staff/orders", permission: "orders.read" },
        { label: "Customers", href: "/staff/customers", permission: "customers.read" },
        { label: "Quotes", href: "/staff/quotes", permission: "quotes.read" },
        { label: "Inventory", href: "/staff/inventory", permission: "inventory.read" }
      ]}
    >
      <div className="portal-grid">
        <article className="portal-card">
          <small>Section</small>
          <strong>{summary.title}</strong>
        </article>
        <article className="portal-card">
          <small>Live total</small>
          <strong>{summary.count}</strong>
        </article>
        <article className="portal-card">
          <small>Current view</small>
          <strong>{summary.detail}</strong>
        </article>
      </div>
      <section className="portal-card" style={{ marginTop: "1.5rem", overflowX: "auto" }}>
        <h2>Recent records</h2>
        {summary.rows.length ? <table><thead><tr>{summary.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{summary.rows.map((row, index) => <tr key={index}>{row.map((value, valueIndex) => <td key={valueIndex}>{value}</td>)}</tr>)}</tbody></table> : <p>No records available yet.</p>}
      </section>
    </PortalShell>
  );
}
