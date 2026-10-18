import Link from "next/link";
import { requireAuthorizedPermission } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { PortalShell } from "@/app/portal-shell";

export const dynamic = "force-dynamic";

export default async function InventoryMovementsPage() {
  const context = await requireAuthorizedPermission("inventory.read");
  const supabase = createSupabaseServiceClient();
  const { data: movements, error } = await supabase
    .from("inventory_movements")
    .select("id,product_id,warehouse_id,quantity,movement_type,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("Unable to load inventory movements:", error.message);
    throw new Error("Recent stock movements could not be loaded.");
  }
  const productIds = [...new Set((movements ?? []).map((movement) => movement.product_id))];
  const warehouseIds = [...new Set((movements ?? []).map((movement) => movement.warehouse_id))];
  const [{ data: products, error: productsError }, { data: warehouses, error: warehousesError }] = await Promise.all([
    productIds.length ? supabase.from("products").select("id,name,sku").in("id", productIds) : Promise.resolve({ data: [], error: null }),
    warehouseIds.length ? supabase.from("warehouses").select("id,name").in("id", warehouseIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (productsError || warehousesError) {
    console.error("Unable to resolve inventory movement details:", productsError?.message ?? warehousesError?.message);
    throw new Error("Stock movement details could not be loaded.");
  }
  const productMap = new Map((products ?? []).map((product) => [product.id, product]));
  const warehouseMap = new Map((warehouses ?? []).map((warehouse) => [warehouse.id, warehouse.name]));

  return (
    <PortalShell
      title="Recent stock movements."
      description="Review the latest recorded changes to warehouse quantities."
      roles={context.roles}
      permissions={context.permissions}
      links={[
        { label: "Overview", href: "/admin" },
        { label: "Inventory", href: "/admin/inventory" },
        { label: "Recent movements", href: "/admin/inventory/movements", permission: "inventory.read" },
        { label: "Purchases", href: "/admin/purchases", permission: "inventory.read" },
      ]}
    >
      <section className="portal-card inventory-movements">
        <div className="section-heading">
          <div><p className="eyebrow">Stock ledger</p><h2>Latest movements</h2></div>
          <Link className="text-link" href="/admin/inventory">Open inventory</Link>
        </div>
        {movements?.length ? (
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead><tr><th>Date</th><th>Product</th><th>Warehouse</th><th>Movement</th><th>Quantity</th></tr></thead>
              <tbody>{movements.map((movement) => {
                const product = productMap.get(movement.product_id);
                return <tr key={movement.id}>
                  <td>{new Date(movement.created_at).toLocaleString()}</td>
                  <td><strong>{product?.name ?? "Unknown product"}</strong><small>{product?.sku ?? movement.product_id}</small></td>
                  <td>{warehouseMap.get(movement.warehouse_id) ?? "Unknown warehouse"}</td>
                  <td>{movement.movement_type.replaceAll("_", " ")}</td>
                  <td>{movement.quantity > 0 ? "+" : ""}{movement.quantity}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        ) : <p>No stock movements have been recorded yet.</p>}
      </section>
    </PortalShell>
  );
}
