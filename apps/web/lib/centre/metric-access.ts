import type { Permission } from "@dantown/shared";
import type { CentreMetrics } from "./metrics";

const metricPermissions: Record<keyof CentreMetrics, Permission[]> = {
  revenueToday: ["reports.read"],
  posSalesToday: ["reports.read"],
  onlineSalesToday: ["reports.read"],
  ordersToday: ["orders.read", "reports.read"],
  pendingOrders: ["orders.read"],
  pendingPayments: ["payments.read"],
  lowStock: ["inventory.read"],
  outOfStock: ["inventory.read"],
  productCount: ["products.read"],
  customerCount: ["customers.read"],
  activePosSessions: ["orders.read"],
  posTransactions: ["orders.read", "reports.read"],
  pendingSync: ["orders.read"],
  failedSync: ["orders.read"],
  conflictSync: ["orders.read"],
  pendingDomainEvents: ["automation.read"],
  retryDomainEvents: ["automation.read"],
  processingDomainEvents: ["automation.read"],
  deadLetterDomainEvents: ["automation.read"],
  aiRequestsToday: ["audit_logs.read"],
  aiHeldActionsToday: ["audit_logs.read"],
  aiFailuresToday: ["audit_logs.read"],
};

export function filterCentreMetricsForPermissions(
  metrics: CentreMetrics,
  permissions: Permission[]
): CentreMetrics {
  const granted = new Set(permissions);

  return Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => [
      key,
      metricPermissions[key as keyof CentreMetrics].some((permission) => granted.has(permission))
        ? value
        : 0,
    ])
  ) as CentreMetrics;
}