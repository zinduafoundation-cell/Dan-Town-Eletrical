import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Permission } from "@dantown/shared";
import { filterCentreMetricsForPermissions } from "./metric-access";

export type CentreMetrics = {
  revenueToday: number;
  posSalesToday: number;
  onlineSalesToday: number;
  ordersToday: number;
  pendingOrders: number;
  pendingPayments: number;
  lowStock: number;
  outOfStock: number;
  productCount: number;
  customerCount: number;
  activePosSessions: number;
  posTransactions: number;
  pendingSync: number;
  failedSync: number;
  conflictSync: number;
  pendingDomainEvents: number;
  retryDomainEvents: number;
  processingDomainEvents: number;
  deadLetterDomainEvents: number;
  aiRequestsToday: number;
  aiHeldActionsToday: number;
  aiFailuresToday: number;
};

export type CentreMetricsResult = {
  metrics: CentreMetrics;
  syncTrackingAvailable: boolean;
  source: "read-model" | "legacy-fallback";
};

const emptyMetrics: CentreMetrics = {
  revenueToday: 0,
  posSalesToday: 0,
  onlineSalesToday: 0,
  ordersToday: 0,
  pendingOrders: 0,
  pendingPayments: 0,
  lowStock: 0,
  outOfStock: 0,
  productCount: 0,
  customerCount: 0,
  activePosSessions: 0,
  posTransactions: 0,
  pendingSync: 0,
  failedSync: 0,
  conflictSync: 0,
  pendingDomainEvents: 0,
  retryDomainEvents: 0,
  processingDomainEvents: 0,
  deadLetterDomainEvents: 0,
  aiRequestsToday: 0,
  aiHeldActionsToday: 0,
  aiFailuresToday: 0,
};

function asNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

export async function getCentreMetrics(permissions: Permission[]): Promise<CentreMetricsResult> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc("get_business_centre_metrics").maybeSingle();

  if (data && !error) {
    return {
      source: "read-model",
      syncTrackingAvailable: true,
      metrics: filterCentreMetricsForPermissions({
        revenueToday: asNumber(data.revenue_today),
        posSalesToday: asNumber(data.pos_sales_today),
        onlineSalesToday: asNumber(data.online_sales_today),
        ordersToday: asNumber(data.orders_today),
        pendingOrders: asNumber(data.pending_orders),
        pendingPayments: asNumber(data.pending_payments),
        lowStock: asNumber(data.low_stock_lines),
        outOfStock: asNumber(data.out_of_stock_lines),
        productCount: asNumber(data.product_count),
        customerCount: asNumber(data.customer_count),
        activePosSessions: asNumber(data.active_pos_sessions),
        posTransactions: asNumber(data.pos_transactions),
        pendingSync: asNumber(data.pending_sync),
        failedSync: asNumber(data.failed_sync),
        conflictSync: asNumber(data.conflict_sync),
        pendingDomainEvents: asNumber(data.pending_domain_events),
        retryDomainEvents: asNumber(data.retry_domain_events),
        processingDomainEvents: asNumber(data.processing_domain_events),
        deadLetterDomainEvents: asNumber(data.dead_letter_domain_events),
        aiRequestsToday: asNumber(data.ai_requests_today),
        aiHeldActionsToday: asNumber(data.ai_held_actions_today),
        aiFailuresToday: asNumber(data.ai_failures_today),
      }, permissions),
    };
  }

  console.warn("Business Centre metrics read model is unavailable; using temporary compatibility fallback.", error);
  const legacyMetrics = await getLegacyMetrics();
  return {
    ...legacyMetrics,
    metrics: filterCentreMetricsForPermissions(legacyMetrics.metrics, permissions),
  };
}

async function getLegacyMetrics(): Promise<CentreMetricsResult> {
  const supabase = createSupabaseServiceClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [{ data: ordersToday }, { count: productCount }, { count: customerCount }, { data: inventory }, { data: sessions }, { data: syncRecords, error: offlineSyncError }] = await Promise.all([
    supabase.from("orders").select("total,payment_status,order_status,sales_channel").gte("created_at", start.toISOString()),
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("inventory").select("quantity,reserved_quantity,reorder_level"),
    supabase.from("pos_sessions").select("id").eq("status", "OPEN"),
    supabase.from("pos_sync_records").select("status"),
  ]);

  const paidToday = (ordersToday ?? []).filter((order) => order.payment_status === "SUCCESS");
  const posSales = paidToday.filter((order) => order.sales_channel === "POS");
  const onlineSales = paidToday.filter((order) => order.sales_channel === "ONLINE");
  const availableInventory = inventory ?? [];
  const visibleSyncRecords = syncRecords ?? [];

  return {
    source: "legacy-fallback",
    syncTrackingAvailable: !offlineSyncError,
    metrics: {
      revenueToday: paidToday.reduce((sum, order) => sum + Number(order.total || 0), 0),
      posSalesToday: posSales.reduce((sum, order) => sum + Number(order.total || 0), 0),
      onlineSalesToday: onlineSales.reduce((sum, order) => sum + Number(order.total || 0), 0),
      ordersToday: ordersToday?.length ?? 0,
      pendingOrders: (ordersToday ?? []).filter((order) => ["PENDING", "PAYMENT_PENDING", "PROCESSING"].includes(order.order_status)).length,
      pendingPayments: (ordersToday ?? []).filter((order) => ["PENDING", "PROCESSING"].includes(order.payment_status)).length,
      lowStock: availableInventory.filter((row) => Number(row.quantity || 0) - Number(row.reserved_quantity || 0) <= Number(row.reorder_level || 0)).length,
      outOfStock: availableInventory.filter((row) => Number(row.quantity || 0) - Number(row.reserved_quantity || 0) <= 0).length,
      productCount: productCount ?? 0,
      customerCount: customerCount ?? 0,
      activePosSessions: sessions?.length ?? 0,
      posTransactions: posSales.length,
      pendingSync: visibleSyncRecords.filter((record) => ["PENDING", "SYNCING"].includes(record.status)).length,
      failedSync: visibleSyncRecords.filter((record) => record.status === "FAILED").length,
      conflictSync: visibleSyncRecords.filter((record) => record.status === "CONFLICT").length,
      pendingDomainEvents: 0,
      retryDomainEvents: 0,
      processingDomainEvents: 0,
      deadLetterDomainEvents: 0,
      aiRequestsToday: 0,
      aiHeldActionsToday: 0,
      aiFailuresToday: 0,
    },
  };
}

export { emptyMetrics };
