export type OfflineQueueSummary = {
  PENDING: number;
  SYNCING: number;
  SYNCED: number;
  FAILED: number;
  CONFLICT: number;
};

export function summarizeOfflineQueue(summary: Partial<OfflineQueueSummary>) {
  const safe = {
    PENDING: 0,
    SYNCING: 0,
    SYNCED: 0,
    FAILED: 0,
    CONFLICT: 0,
    ...summary
  };

  const queued = safe.PENDING + safe.SYNCING + safe.FAILED + safe.CONFLICT;
  const total = queued + safe.SYNCED;
  const tone = queued === 0 ? "healthy" : safe.CONFLICT > 0 || safe.FAILED > 0 ? "critical" : "warning";

  return {
    tone,
    total,
    queued,
    headline: queued === 0 ? `${safe.SYNCED} synced and ready` : `${queued} queued for sync`,
    details: [
      safe.PENDING ? `${safe.PENDING} pending` : "No pending sales",
      safe.SYNCING ? `${safe.SYNCING} syncing` : "No sales syncing",
      safe.FAILED ? `${safe.FAILED} failed` : "No failed sales",
      safe.CONFLICT ? `${safe.CONFLICT} conflicts` : "No sync conflicts"
    ]
  };
}
