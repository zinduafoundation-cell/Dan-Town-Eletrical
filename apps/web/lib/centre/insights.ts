import { createSupabaseServiceClient } from "@/lib/supabase/server";

function startOfTodayUtcPlus3() {
  // Kitale is UTC+3 (East Africa Time): "today" starts at 00:00 EAT.
  const now = new Date();
  const eat = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  eat.setUTCHours(0, 0, 0, 0);
  return new Date(eat.getTime() - 3 * 60 * 60 * 1000).toISOString();
}

export type StaffActivityRow = {
  userId: string;
  name: string;
  posSales: number;
  posRevenue: number;
  refunds: number;
  biometricSignIns: number;
  failedChecks: number;
};

/**
 * Everyone on the team shares one role, so "who did what" has to come from the
 * person, not the role. This rolls up today's POS sales, refunds and biometric
 * security events per staff member.
 */
export async function getStaffActivityToday(): Promise<StaffActivityRow[]> {
  const db = createSupabaseServiceClient();
  const since = startOfTodayUtcPlus3();

  const [{ data: sales }, { data: events }] = await Promise.all([
    db.from("orders").select("created_by, total, order_status").eq("sales_channel", "POS").gte("created_at", since).not("created_by", "is", null),
    db.from("audit_logs").select("user_id, action").gte("created_at", since).in("action", ["BIOMETRIC_LOGIN", "BIOMETRIC_CONFIRMED", "BIOMETRIC_FAILED", "RETURN_PROCESSED"]).not("user_id", "is", null),
  ]);

  const rows = new Map<string, StaffActivityRow>();
  const get = (userId: string) => {
    if (!rows.has(userId)) rows.set(userId, { userId, name: "Staff member", posSales: 0, posRevenue: 0, refunds: 0, biometricSignIns: 0, failedChecks: 0 });
    return rows.get(userId)!;
  };

  for (const sale of sales ?? []) {
    if (["CANCELLED", "FAILED"].includes(String(sale.order_status))) continue;
    const row = get(sale.created_by as string);
    row.posSales += 1;
    row.posRevenue += Number(sale.total ?? 0);
  }
  for (const event of events ?? []) {
    const row = get(event.user_id as string);
    if (event.action === "BIOMETRIC_LOGIN" || event.action === "BIOMETRIC_CONFIRMED") row.biometricSignIns += 1;
    else if (event.action === "BIOMETRIC_FAILED") row.failedChecks += 1;
    else row.refunds += 1;
  }

  if (!rows.size) return [];
  const { data: profiles } = await db.from("profiles").select("id, full_name").in("id", Array.from(rows.keys()));
  for (const profile of profiles ?? []) if (rows.has(profile.id)) rows.get(profile.id)!.name = profile.full_name || "Staff member";

  return Array.from(rows.values()).sort((a, b) => b.posRevenue - a.posRevenue);
}

export type ReorderLine = { productId: string; name: string; sku: string; available: number; reorderLevel: number; suggested: number };

/** Lines at or below their reorder level, with a suggested quantity to buy. */
export async function getReorderList(limit = 12): Promise<ReorderLine[]> {
  const db = createSupabaseServiceClient();
  const { data: stock } = await db.from("inventory").select("product_id, quantity, reserved_quantity, reorder_level, reorder_quantity");
  const totals = new Map<string, { available: number; level: number; reorderQuantity: number }>();
  for (const row of stock ?? []) {
    const current = totals.get(row.product_id) ?? { available: 0, level: 0, reorderQuantity: 0 };
    current.available += Math.max(0, row.quantity - row.reserved_quantity);
    current.level += row.reorder_level;
    current.reorderQuantity = Math.max(current.reorderQuantity, row.reorder_quantity);
    totals.set(row.product_id, current);
  }
  const low = Array.from(totals.entries()).filter(([, value]) => value.level > 0 && value.available <= value.level);
  if (!low.length) return [];

  const { data: products } = await db.from("products").select("id, name, sku").in("id", low.map(([id]) => id)).eq("is_active", true);
  return (products ?? [])
    .map((product) => {
      const value = totals.get(product.id)!;
      return {
        productId: product.id, name: product.name, sku: product.sku, available: value.available, reorderLevel: value.level,
        suggested: value.reorderQuantity > 0 ? value.reorderQuantity : Math.max(value.level * 2 - value.available, 1),
      };
    })
    .sort((a, b) => a.available - b.available)
    .slice(0, limit);
}
