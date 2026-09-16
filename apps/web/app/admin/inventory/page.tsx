import { requireAuthorizedPermission } from "../../../lib/auth/server";
import { createSupabaseServiceClient } from "../../../lib/supabase/server";
import { PortalShell } from "../../portal-shell";
import { InventoryWorkspace } from "@/components/admin/inventory-workspace";
import { WarehouseForm } from "@/components/admin/warehouse-form";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const context = await requireAuthorizedPermission("inventory.read");
  const supabase = createSupabaseServiceClient();
  const [{ data: inventory }, { data: products }, { data: warehouses }, { data: categories }, { data: brands }] = await Promise.all([
    supabase.from("inventory").select("id,product_id,warehouse_id,quantity,reserved_quantity,reorder_level"),
    supabase.from("products").select("id,name,sku,barcode,category_id,brand_id,cost_price,retail_price,status,is_active"),
    supabase.from("warehouses").select("id,name").eq("is_active", true).order("name"),
    supabase.from("categories").select("id,name"),
    supabase.from("brands").select("id,name")
  ]);
  const productMap = new Map((products ?? []).map((product) => [product.id, product]));
  const warehouseMap = new Map((warehouses ?? []).map((warehouse) => [warehouse.id, warehouse.name]));
  const categoryMap = new Map((categories ?? []).map((category) => [category.id, category.name]));
  const brandMap = new Map((brands ?? []).map((brand) => [brand.id, brand.name]));
  const rows = (inventory ?? []).flatMap((stock) => {
    const product = productMap.get(stock.product_id);
    if (!product) return [];
    return [{ id: stock.id, productId: stock.product_id, name: product.name, sku: product.sku, barcode: product.barcode, category: categoryMap.get(product.category_id ?? "") ?? "Uncategorized", brand: brandMap.get(product.brand_id ?? "") ?? "No brand", warehouseId: stock.warehouse_id, warehouse: warehouseMap.get(stock.warehouse_id) ?? "Unknown warehouse", quantity: stock.quantity, reserved: stock.reserved_quantity, reorderLevel: stock.reorder_level, costPrice: Number(product.cost_price || 0), retailPrice: Number(product.retail_price || 0), status: product.status, published: product.status === "ACTIVE" && product.is_active, posAvailable: product.status === "ACTIVE" && product.is_active }];
  });

  return <PortalShell title="Stock & inventory." description="Search, filter, inspect, and safely adjust the shared stock ledger." roles={context.roles} permissions={context.permissions} links={[{ label: "Overview", href: "/admin" }, { label: "Inventory", href: "/admin/inventory" }, { label: "Products", href: "/admin/catalog", permission: "products.read" }, { label: "Suppliers", href: "/admin/suppliers", permission: "products.read" }, { label: "Purchases", href: "/admin/purchases", permission: "inventory.read" }, { label: "Warehouses", href: "/admin/warehouses", permission: "inventory.read" }]}>
    <WarehouseForm initialWarehouses={(warehouses ?? []).map((warehouse) => ({ id: warehouse.id, name: warehouse.name }))} canManage={context.permissions.includes("inventory.adjust")} />
    <InventoryWorkspace rows={rows} warehouses={(warehouses ?? []).map((warehouse) => ({ id: warehouse.id, name: warehouse.name }))} canTransfer={context.permissions.includes("inventory.adjust")} />
  </PortalShell>;
}
