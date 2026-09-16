import { requireAuthorizedPermission } from "../../lib/auth/server";
import { createSupabaseServiceClient } from "../../lib/supabase/server";
import { PortalShell } from "../portal-shell";
import { AdminControlCentre, type CentreSummary } from "@/components/admin/admin-control-centre";
import { SharedAIPanel } from "@/components/ai/shared-ai-panel";
import type { Permission, UserRole } from "@dantown/shared";

export const dynamic = "force-dynamic";

async function getCentreSummary(): Promise<CentreSummary> {
  const supabase = createSupabaseServiceClient();
  const [{ data: products }, { data: inventory }, { count: suppliers }, { count: warehouses }, { count: recentPurchases }, { count: recentMovements }, { count: awaitingReview }, { count: syncPending }, { count: syncFailed }, { count: automationActive }, { data: imageRows }] = await Promise.all([
    supabase.from("products").select("id, status, is_active, cost_price, retail_price, category_id"),
    supabase.from("inventory").select("product_id, quantity, reserved_quantity, reorder_level"),
    supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
    supabase.from("warehouses").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("purchase_orders").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from("inventory_movements").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from("product_drafts").select("id", { count: "exact", head: true }).in("status", ["REQUIRES_REVIEW", "PENDING"]),
    supabase.from("pos_sync_records").select("transaction_id", { count: "exact", head: true }).in("status", ["PENDING", "SYNCING"]),
    supabase.from("pos_sync_records").select("transaction_id", { count: "exact", head: true }).in("status", ["FAILED", "CONFLICT"]),
    supabase.from("automation_jobs").select("id", { count: "exact", head: true }).in("status", ["RECEIVED", "PROCESSING"]),
    supabase.from("product_images").select("product_id")
  ]);

  const productRows = products ?? [];
  const imageProductIds = new Set((imageRows ?? []).map((row) => row.product_id));
  const inventoryByProduct = new Map<string, { quantity: number; reserved: number; reorder: number }>();
  for (const row of inventory ?? []) {
    const current = inventoryByProduct.get(row.product_id) ?? { quantity: 0, reserved: 0, reorder: 0 };
    current.quantity += Number(row.quantity || 0);
    current.reserved += Number(row.reserved_quantity || 0);
    current.reorder = Math.max(current.reorder, Number(row.reorder_level || 0));
    inventoryByProduct.set(row.product_id, current);
  }

  let totalStock = 0;
  let inventoryValue = 0;
  let lowStockProducts = 0;
  let outOfStockProducts = 0;
  for (const product of productRows) {
    const stock = inventoryByProduct.get(product.id) ?? { quantity: 0, reserved: 0, reorder: 0 };
    const available = Math.max(0, stock.quantity - stock.reserved);
    totalStock += available;
    inventoryValue += available * Number(product.cost_price || 0);
    if (available === 0) outOfStockProducts += 1;
    else if (available <= stock.reorder) lowStockProducts += 1;
  }

  return {
    totalProducts: productRows.length,
    activeProducts: productRows.filter((product) => product.status === "ACTIVE" && product.is_active).length,
    draftProducts: productRows.filter((product) => product.status === "DRAFT").length,
    productsAwaitingReview: awaitingReview ?? 0,
    totalStock,
    inventoryValue: Math.round(inventoryValue),
    lowStockProducts,
    outOfStockProducts,
    suppliers: suppliers ?? 0,
    warehouses: warehouses ?? 0,
    recentPurchases: recentPurchases ?? 0,
    recentMovements: recentMovements ?? 0,
    missingPrices: productRows.filter((product) => Number(product.cost_price || 0) <= 0 || Number(product.retail_price || 0) <= 0).length,
    missingImages: productRows.filter((product) => !imageProductIds.has(product.id)).length,
    missingCategories: productRows.filter((product) => !product.category_id).length,
    unpublishedProducts: productRows.filter((product) => !(product.status === "ACTIVE" && product.is_active)).length,
    posUnavailable: productRows.filter((product) => product.status !== "ACTIVE" || !product.is_active).length,
    syncPending: syncPending ?? 0,
    syncFailed: syncFailed ?? 0,
    automationActive: automationActive ?? 0
  };
}

export default async function AdminPage() {
  const context = await requireAuthorizedPermission("users.read");
  const summary = await getCentreSummary();
  const links: Array<{ label: string; href: string; permission?: Permission; roles?: UserRole[] }> = [
    { label: "Overview", href: "/admin" },
    { label: "Catalog manager", href: "/admin/catalog", permission: "products.update" as const },
    { label: "Products", href: "/admin/products", permission: "products.read" as const },
    { label: "Inventory", href: "/admin/inventory", permission: "inventory.read" as const },
    { label: "Suppliers", href: "/admin/suppliers", permission: "products.read" as const },
    { label: "Purchases", href: "/admin/purchases", permission: "inventory.read" as const },
    { label: "Automation", href: "/admin/automation", permission: "automation.read" as const },
    { label: "Team", href: "/admin/team", permission: "users.read" as const },
    { label: "CEO view", href: "/admin/ceo", roles: ["CEO"] }
  ];

  return <PortalShell title="Dantown Centre." description="One connected control plane for products, stock, suppliers, purchasing, automation, website publishing, and POS availability." roles={context.roles} permissions={context.permissions} links={links}>
    <AdminControlCentre summary={summary} permissions={context.permissions} />
    <div style={{ marginTop: 28 }}><SharedAIPanel title="Dan T AI Centre Assistant" subtitle="Permission-aware business summaries from the same Supabase source of truth" surface="admin" suggestions={["Which products are low in stock?", "Show products awaiting review.", "Which products are not published?", "Summarize recent stock activity."]} compact /></div>
  </PortalShell>;
}
