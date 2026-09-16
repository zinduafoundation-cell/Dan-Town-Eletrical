import { requireAuthorizedPermission } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { PortalShell } from "../../portal-shell";
import type { Permission } from "@dantown/shared";

export const dynamic = "force-dynamic";

const labelMap: Record<string, string> = {
  products: "Products",
  categories: "Categories",
  orders: "Orders",
  customers: "Customers",
  inventory: "Inventory",
  suppliers: "Suppliers",
  purchases: "Purchases",
  warehouses: "Warehouses",
  payments: "Payments",
  reports: "Reports",
  "audit-logs": "Audit logs",
};

const permissionMap: Record<string, Permission> = {
  products: "products.read",
  categories: "products.update",
  orders: "orders.read",
  customers: "customers.read",
  inventory: "inventory.read",
  suppliers: "products.read",
  purchases: "inventory.read",
  warehouses: "inventory.read",
  payments: "payments.read",
  reports: "reports.read",
  "audit-logs": "audit_logs.read",
};

async function getSectionSummary(slug: string) {
  const supabase = createSupabaseServiceClient();

  switch (slug) {
    case "products": {
      const { count, error } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true });

      const { data: recent } = await supabase
        .from("products")
        .select("name,sku,retail_price,is_active,created_at")
        .order("created_at", { ascending: false })
        .limit(8);

      return {
        title: labelMap[slug],
        count: error ? 0 : count ?? 0,
        detail: "Catalog entries",
        columns: ["Product", "SKU", "Price", "Active"],
        rows: (recent ?? []).map((row) => [
          row.name,
          row.sku,
          `Ksh ${Number(row.retail_price ?? 0).toLocaleString()}`,
          row.is_active ? "Yes" : "No",
        ]),
      };
    }

    case "categories": {
      const { count, error } = await supabase
        .from("categories")
        .select("id", { count: "exact", head: true });

      const { data: recent } = await supabase
        .from("categories")
        .select("name,is_active,created_at")
        .order("created_at", { ascending: false })
        .limit(8);

      return {
        title: labelMap[slug],
        count: error ? 0 : count ?? 0,
        detail: "Category structure",
        columns: ["Category", "Active", "Created"],
        rows: (recent ?? []).map((row) => [
          row.name,
          row.is_active ? "Yes" : "No",
          new Date(row.created_at).toLocaleDateString(),
        ]),
      };
    }

    case "orders": {
      const { count, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true });

      const { data: recent } = await supabase
        .from("orders")
        .select("order_number,total,payment_status,created_at")
        .order("created_at", { ascending: false })
        .limit(8);

      return {
        title: labelMap[slug],
        count: error ? 0 : count ?? 0,
        detail: "Sales history",
        columns: ["Order", "Total", "Payment", "Created"],
        rows: (recent ?? []).map((row) => [
          row.order_number,
          `Ksh ${Number(row.total ?? 0).toLocaleString()}`,
          row.payment_status,
          new Date(row.created_at).toLocaleDateString(),
        ]),
      };
    }

    case "customers": {
      const { count, error } = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true });

      const { data: recent } = await supabase
        .from("customers")
        .select("name,email,status,created_at")
        .order("created_at", { ascending: false })
        .limit(8);

      return {
        title: labelMap[slug],
        count: error ? 0 : count ?? 0,
        detail: "Customer accounts",
        columns: ["Name", "Email", "Status", "Created"],
        rows: (recent ?? []).map((row) => [
          row.name,
          row.email ?? "No email",
          row.status,
          new Date(row.created_at).toLocaleDateString(),
        ]),
      };
    }

    case "inventory": {
      const { data, error } = await supabase.from("inventory").select("quantity");
      const total = (data ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);

      const [{ data: recent }, { data: products }] = await Promise.all([
        supabase.from("inventory").select("product_id,quantity,reserved_quantity,reorder_level").limit(8),
        supabase.from("products").select("id,name,sku"),
      ]);

      const productMap = new Map((products ?? []).map((product) => [product.id, product]));

      return {
        title: labelMap[slug],
        count: error ? 0 : total,
        detail: "Stock on hand",
        columns: ["Product", "SKU", "Available", "Reserved", "Reorder"],
        rows: (recent ?? []).map((row) => {
          const product = productMap.get(row.product_id);
          return [
            product?.name ?? "Unknown",
            product?.sku ?? "",
            String(Number(row.quantity ?? 0) - Number(row.reserved_quantity ?? 0)),
            String(Number(row.reserved_quantity ?? 0)),
            String(Number(row.reorder_level ?? 0)),
          ];
        }),
      };
    }

    case "suppliers": {
      const { count, error } = await supabase
        .from("suppliers")
        .select("id", { count: "exact", head: true })
        .eq("status", "ACTIVE");

      const { data: recent } = await supabase
        .from("suppliers")
        .select("company_name,contact_name,phone,status,created_at")
        .order("created_at", { ascending: false })
        .limit(8);

      return {
        title: labelMap[slug],
        count: error ? 0 : count ?? 0,
        detail: "Active supplier network",
        columns: ["Company", "Contact", "Phone", "Status"],
        rows: (recent ?? []).map((row) => [
          row.company_name,
          row.contact_name ?? "No contact",
          row.phone ?? "No phone",
          row.status,
        ]),
      };
    }

    case "purchases": {
      const { count, error } = await supabase
        .from("purchase_orders")
        .select("id", { count: "exact", head: true });

      const { data: recent } = await supabase
        .from("purchase_orders")
        .select("order_number,supplier_id,status,total,created_at")
        .order("created_at", { ascending: false })
        .limit(8);

      const supplierIds = [...new Set((recent ?? []).map((row) => row.supplier_id).filter(Boolean))];
      const { data: suppliers } = supplierIds.length
        ? await supabase.from("suppliers").select("id,company_name").in("id", supplierIds)
        : { data: [] };

      const supplierMap = new Map((suppliers ?? []).map((supplier) => [supplier.id, supplier.company_name]));

      return {
        title: labelMap[slug],
        count: error ? 0 : count ?? 0,
        detail: "Purchase orders",
        columns: ["Order", "Supplier", "Status", "Total"],
        rows: (recent ?? []).map((row) => [
          row.order_number,
          supplierMap.get(row.supplier_id) ?? "Unknown supplier",
          row.status,
          `Ksh ${Number(row.total ?? 0).toLocaleString()}`,
        ]),
      };
    }

    case "warehouses": {
      const { count, error } = await supabase
        .from("warehouses")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);

      const { data: recent } = await supabase
        .from("warehouses")
        .select("name,code,location,is_active")
        .order("name")
        .limit(8);

      return {
        title: labelMap[slug],
        count: error ? 0 : count ?? 0,
        detail: "Active warehouses",
        columns: ["Warehouse", "Code", "Location", "Status"],
        rows: (recent ?? []).map((row) => [
          row.name,
          row.code,
          row.location ?? "No location",
          row.is_active ? "Active" : "Inactive",
        ]),
      };
    }

    case "payments": {
      const { count, error } = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true });

      const { data: recent } = await supabase
        .from("payments")
        .select("order_id,method,amount,status")
        .limit(8);

      return {
        title: labelMap[slug],
        count: error ? 0 : count ?? 0,
        detail: "Payment activity",
        columns: ["Order", "Method", "Amount", "Status"],
        rows: (recent ?? []).map((row) => [
          row.order_id,
          row.method,
          `Ksh ${Number(row.amount ?? 0).toLocaleString()}`,
          row.status,
        ]),
      };
    }

    case "reports": {
      return {
        title: labelMap[slug],
        count: 0,
        detail: "Operational reporting",
        columns: [],
        rows: [],
      };
    }

    case "audit-logs": {
      const { count, error } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true });

      return {
        title: labelMap[slug],
        count: error ? 0 : count ?? 0,
        detail: "Operational activity",
        columns: [],
        rows: [],
      };
    }

    default: {
      return {
        title: labelMap[slug] ?? slug.replace(/-/g, " "),
        count: 0,
        detail: "Section summary",
        columns: [],
        rows: [],
      };
    }
  }
}

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const route = slug ?? "products";
  const context = await requireAuthorizedPermission(permissionMap[route] ?? "products.read");
  const summary = await getSectionSummary(route);
  const title = labelMap[route] ?? route.replace(/-/g, " ");

  return (
    <PortalShell
      title={`${title} workspace`}
      description={`Leadership and operations overview for ${title.toLowerCase()} in the Dantown workflow.`}
      roles={context.roles}
      permissions={context.permissions}
      links={[
        { label: "Overview", href: "/admin" },
        { label: "Products", href: "/admin/products", permission: "products.read" },
        { label: "Categories", href: "/admin/categories", permission: "products.update" },
        { label: "Orders", href: "/admin/orders", permission: "orders.read" },
        { label: "Customers", href: "/admin/customers", permission: "customers.read" },
        { label: "Inventory", href: "/admin/inventory", permission: "inventory.read" },
        { label: "Suppliers", href: "/admin/suppliers", permission: "products.read" },
        { label: "Purchases", href: "/admin/purchases", permission: "inventory.read" },
        { label: "Warehouses", href: "/admin/warehouses", permission: "inventory.read" },
        { label: "Payments", href: "/admin/payments", permission: "payments.read" },
        { label: "Reports", href: "/admin/reports", permission: "reports.read" },
        { label: "Audit logs", href: "/admin/audit-logs", permission: "audit_logs.read" },
      ]}
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Section summary</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">{summary.title}</h2>
            </div>
            <div className="rounded-xl bg-slate-100 px-4 py-2 text-right">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Count</div>
              <div className="text-2xl font-bold text-slate-900">{summary.count}</div>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">{summary.detail}</p>
        </section>

        {summary.columns.length > 0 ? (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {summary.columns.map((column) => (
                      <th key={column} className="px-4 py-3 font-medium text-slate-700">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {summary.rows.map((row, rowIndex) => (
                    <tr key={`${summary.title}-${rowIndex}`} className="bg-white">
                      {row.map((cell, cellIndex) => (
                        <td key={`${summary.title}-${rowIndex}-${cellIndex}`} className="px-4 py-3 text-slate-700">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
            No detailed records are available for this section yet.
          </section>
        )}
      </div>
    </PortalShell>
  );
}