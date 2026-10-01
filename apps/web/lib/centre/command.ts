import type { AuthorizationContext } from "@dantown/auth";
import { hasPermission } from "@dantown/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { parseCentreCommand, type CentreCommandKind } from "./command-parser";

export { parseCentreCommand, type CentreCommandKind } from "./command-parser";

export type CentreCommandItem = {
  label: string;
  detail: string;
  tone?: "alert" | "neutral";
};

export type CentreCommandResult = {
  kind: CentreCommandKind;
  title: string;
  summary: string;
  items: CentreCommandItem[];
  href?: string;
  hrefLabel?: string;
};

type OrderOrPaymentStatus =
  | "PENDING"
  | "PAYMENT_PENDING"
  | "PAID"
  | "PROCESSING"
  | "READY_FOR_PICKUP"
  | "READY_FOR_DELIVERY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "FAILED"
  | "SUCCESS";

function hasAnyPermission(
  context: AuthorizationContext,
  permissions: Parameters<typeof hasPermission>[1][]
) {
  return permissions.some((permission) => hasPermission(context, permission));
}

function needsPermission() {
  return {
    kind: "help" as const,
    title: "Permission required",
    summary: "Your account does not have permission to view that operational data.",
    items: [],
  };
}

function formatMoney(value: number) {
  return `KSh ${Math.round(value).toLocaleString("en-KE")}`;
}

function startOfToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

async function getLowStockItems() {
  const supabase = createSupabaseServiceClient();
  const { data: health, error } = await supabase
    .from("inventory_health")
    .select("product_id,available_quantity,reorder_level")
    .eq("is_low_stock", true)
    .order("available_quantity", { ascending: true })
    .limit(8);

  if (error) throw error;

  const productIds = [...new Set((health ?? []).map((row) => row.product_id))];
  const { data: products } = productIds.length
    ? await supabase.from("products").select("id,name,sku").in("id", productIds)
    : { data: [] };
  const productById = new Map((products ?? []).map((product) => [product.id, product]));

  return (health ?? []).map((row) => {
    const product = productById.get(row.product_id);
    return {
      label: product?.name ?? "Unknown product",
      detail: `${product?.sku ?? row.product_id} · ${row.available_quantity} available · reorder at ${row.reorder_level}`,
      tone: "alert" as const,
    };
  });
}

async function getOrders(
  statuses: { field: "order_status" | "payment_status"; values: OrderOrPaymentStatus[] },
  title: string,
  summary: string
): Promise<CentreCommandResult> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("order_number,total,payment_status,order_status,created_at")
    .in(statuses.field, statuses.values)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw error;

  return {
    kind: statuses.field === "payment_status" ? "unpaid-orders" : "pending-orders",
    title,
    summary: data?.length ? summary : "No matching orders need attention right now.",
    items: (data ?? []).map((order) => ({
      label: order.order_number,
      detail: `${formatMoney(Number(order.total))} · ${order.payment_status} · ${order.order_status}`,
      tone: "alert" as const,
    })),
    href: "/admin/orders",
    hrefLabel: "Open order workspace",
  };
}

async function getRecentOrders(): Promise<CentreCommandResult> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("order_number,total,payment_status,order_status,created_at")
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw error;

  return {
    kind: "recent-orders",
    title: "Latest operational orders",
    summary: "Showing the eight most recent orders across the shared order system.",
    items: (data ?? []).map((order) => ({
      label: order.order_number,
      detail: `${formatMoney(Number(order.total))} · ${order.payment_status} · ${order.order_status}`,
    })),
    href: "/admin/orders",
    hrefLabel: "Open order workspace",
  };
}

async function getAttention(context: AuthorizationContext): Promise<CentreCommandResult> {
  const items: CentreCommandItem[] = [];
  const supabase = createSupabaseServiceClient();

  if (hasPermission(context, "orders.read")) {
    const { data: pendingOrders, error } = await supabase
      .from("orders")
      .select("order_number,total,payment_status,order_status")
      .in("order_status", ["PENDING", "PAYMENT_PENDING", "PROCESSING"])
      .order("created_at", { ascending: false })
      .limit(4);
    if (error) throw error;
    items.push(
      ...(pendingOrders ?? []).map((order) => ({
        label: `Order ${order.order_number}`,
        detail: `${formatMoney(Number(order.total))} · ${order.payment_status} · ${order.order_status}`,
        tone: "alert" as const,
      }))
    );
  }

  if (hasPermission(context, "inventory.read")) {
    items.push(...(await getLowStockItems()).slice(0, 4));
  }

  if (hasPermission(context, "orders.read")) {
    const { data: syncRecords, error } = await supabase
      .from("pos_sync_records")
      .select("device_id,status,retry_count")
      .in("status", ["PENDING", "SYNCING", "FAILED", "CONFLICT"])
      .order("created_at", { ascending: false })
      .limit(4);
    if (!error) {
      items.push(
        ...(syncRecords ?? []).map((record) => ({
          label: `POS sync · ${record.device_id}`,
          detail: `${record.status} · retry ${record.retry_count ?? 0}`,
          tone: "alert" as const,
        }))
      );
    }
  }

  return {
    kind: "attention",
    title: "Today's attention queue",
    summary: items.length
      ? "These are live, permission-filtered operational signals. Review an item before taking action."
      : "No visible order, inventory, or POS-sync risks need attention right now.",
    items: items.slice(0, 8),
    href: "/admin",
    hrefLabel: "Open operations workspace",
  };
}

export async function executeCentreCommand(
  input: string,
  context: AuthorizationContext
): Promise<CentreCommandResult> {
  const command = parseCentreCommand(input);

  if (command.kind === "approval-required") {
    return {
      kind: "approval-required",
      title: "Action held for approval",
      summary:
        "DAN T AI can guide you to the correct workspace, but it does not create, change, approve, refund, or delete business data from this command bar.",
      items: [
        {
          label: "No data was changed",
          detail: "Use the appropriate protected workspace to review and confirm an action.",
          tone: "neutral",
        },
      ],
      href: "/admin",
      hrefLabel: "Open operations workspace",
    };
  }

  if (command.kind === "low-stock") {
    if (!hasPermission(context, "inventory.read")) return needsPermission();
    const items = await getLowStockItems();
    return {
      kind: "low-stock",
      title: "Low-stock inventory",
      summary: items.length
        ? "Showing the highest-risk stock lines from the inventory-health view."
        : "No low-stock inventory lines are currently visible.",
      items,
      href: "/admin/inventory",
      hrefLabel: "Open inventory workspace",
    };
  }

  if (command.kind === "unpaid-orders") {
    if (!hasPermission(context, "orders.read")) return needsPermission();
    return getOrders(
      { field: "payment_status", values: ["PENDING", "PROCESSING", "FAILED"] },
      "Orders awaiting payment resolution",
      "Showing recent orders with a pending, processing, or failed payment state."
    );
  }

  if (command.kind === "pending-orders") {
    if (!hasPermission(context, "orders.read")) return needsPermission();
    return getOrders(
      { field: "order_status", values: ["PENDING", "PAYMENT_PENDING", "PROCESSING"] },
      "Pending order queue",
      "Showing recent orders that have not reached a ready, delivered, cancelled, or refunded state."
    );
  }

  if (command.kind === "recent-orders") {
    if (!hasPermission(context, "orders.read")) return needsPermission();
    return getRecentOrders();
  }

  if (command.kind === "sales") {
    if (!hasPermission(context, "reports.read")) return needsPermission();
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("orders")
      .select("order_number,total,sales_channel")
      .eq("payment_status", "SUCCESS")
      .gte("created_at", startOfToday())
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const revenue = (data ?? []).reduce((total, order) => total + Number(order.total), 0);
    return {
      kind: "sales",
      title: "Today’s paid sales",
      summary: `The first ${data?.length ?? 0} paid orders today total ${formatMoney(revenue)}. Use Finance Dashboard for the full reporting view.`,
      items: (data ?? []).slice(0, 8).map((order) => ({
        label: order.order_number,
        detail: `${formatMoney(Number(order.total))} · ${order.sales_channel}`,
      })),
      href: "/admin/dashboard",
      hrefLabel: "Open Finance Dashboard",
    };
  }

  if (command.kind === "attention") return getAttention(context);

  const hasAccess = hasAnyPermission(context, [
    "orders.read",
    "inventory.read",
    "reports.read",
  ]);
  return {
    kind: "help",
    title: "Try an operational command",
    summary: hasAccess
      ? "Ask about attention items, low stock, unpaid orders, pending orders, recent orders, or today’s sales."
      : "Your current role has no operational data permissions assigned.",
    items: hasAccess
      ? [
          { label: "What needs my attention today?", detail: "Prioritized visible order, inventory, and POS-sync signals." },
          { label: "Show unpaid orders", detail: "Recent orders that need payment resolution." },
          { label: "Find products below minimum stock", detail: "Live results from inventory health." },
        ]
      : [],
  };
}
