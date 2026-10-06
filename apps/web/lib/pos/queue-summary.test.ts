import { describe, expect, it } from "vitest";
import { summarizeOfflineQueue } from "./queue-summary";

describe("summarizeOfflineQueue", () => {
  it("reports a healthy queue when only synced sales remain", () => {
    const summary = summarizeOfflineQueue({ PENDING: 0, SYNCING: 0, SYNCED: 8, FAILED: 0, CONFLICT: 0 });

    expect(summary.headline).toContain("8 synced");
    expect(summary.tone).toBe("healthy");
  });

  it("shows a warning and pending count when there are queued sales waiting to sync", () => {
    const summary = summarizeOfflineQueue({ PENDING: 2, SYNCING: 1, SYNCED: 4, FAILED: 0, CONFLICT: 0 });

    expect(summary.headline).toContain("3 queued");
    expect(summary.tone).toBe("warning");
  });
});
