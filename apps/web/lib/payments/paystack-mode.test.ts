import { describe, expect, it } from "vitest";
import { getPaystackMode } from "./paystack-mode";

describe("getPaystackMode", () => {
  it("recognizes Paystack test and live keys", () => {
    expect(getPaystackMode("sk_test_example")).toBe("test");
    expect(getPaystackMode("sk_live_example")).toBe("live");
  });

  it("rejects missing or unsupported keys", () => {
    expect(getPaystackMode(undefined)).toBeNull();
    expect(getPaystackMode("pk_test_example")).toBeNull();
    expect(getPaystackMode("")).toBeNull();
  });
});
