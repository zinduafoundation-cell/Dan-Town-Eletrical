import { describe, expect, it } from "vitest";
import { belongsToStaff, canQueueOfflineSale, getRetryDelayMs, getSyncFailureStatus } from "./offline-queue";

describe("offline POS retry policy", () => {
  it("backs off retries and caps the delay", () => {
    expect(getRetryDelayMs(1)).toBe(2_000);
    expect(getRetryDelayMs(4)).toBe(16_000);
    expect(getRetryDelayMs(9)).toBe(300_000);
  });

  it("does not retry authorization, validation, or conflict failures", () => {
    expect(getSyncFailureStatus(400, 1)).toBe("CONFLICT");
    expect(getSyncFailureStatus(401, 1)).toBe("CONFLICT");
    expect(getSyncFailureStatus(409, 1)).toBe("CONFLICT");
    expect(getSyncFailureStatus(503, 1)).toBe("FAILED");
    expect(getSyncFailureStatus(503, 5)).toBe("CONFLICT");
  });

  it("only queues non-split cash sales offline", () => {
    expect(canQueueOfflineSale("cash", false)).toBe(true);
    expect(canQueueOfflineSale("cash", true)).toBe(false);
    expect(canQueueOfflineSale("mpesa", false)).toBe(false);
    expect(canQueueOfflineSale("card", false)).toBe(false);
    expect(canQueueOfflineSale("bank", false)).toBe(false);
  });

  it("syncs queued sales only for the staff member who created them", () => {
    expect(belongsToStaff("staff-a", "staff-a")).toBe(true);
    expect(belongsToStaff("staff-a", "staff-b")).toBe(false);
    expect(belongsToStaff(null, "staff-a")).toBe(false);
    expect(belongsToStaff("staff-a", null)).toBe(false);
  });
});