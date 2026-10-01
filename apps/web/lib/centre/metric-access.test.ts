import { describe, expect, it } from "vitest";
import type { CentreMetrics } from "./metrics";
import { filterCentreMetricsForPermissions } from "./metric-access";

const metrics: CentreMetrics = {
  revenueToday: 1000,
  posSalesToday: 400,
  onlineSalesToday: 600,
  ordersToday: 8,
  pendingOrders: 2,
  pendingPayments: 3,
  lowStock: 4,
  outOfStock: 1,
  productCount: 20,
  customerCount: 12,
  activePosSessions: 2,
  posTransactions: 5,
  pendingSync: 1,
  failedSync: 1,
  conflictSync: 0,
  pendingDomainEvents: 2,
  retryDomainEvents: 1,
  processingDomainEvents: 1,
  deadLetterDomainEvents: 0,
  aiRequestsToday: 7,
  aiHeldActionsToday: 2,
  aiFailuresToday: 1,
};

describe("Centre metric permissions", () => {
  it("limits an inventory-only role to stock metrics", () => {
    const visible = filterCentreMetricsForPermissions(metrics, ["inventory.read"]);

    expect(visible.lowStock).toBe(4);
    expect(visible.outOfStock).toBe(1);
    expect(visible.revenueToday).toBe(0);
    expect(visible.ordersToday).toBe(0);
    expect(visible.pendingPayments).toBe(0);
    expect(visible.customerCount).toBe(0);
  });

  it("returns no metrics when no reporting permission is granted", () => {
    expect(filterCentreMetricsForPermissions(metrics, [])).toEqual(
      Object.fromEntries(Object.keys(metrics).map((key) => [key, 0]))
    );
  });
});