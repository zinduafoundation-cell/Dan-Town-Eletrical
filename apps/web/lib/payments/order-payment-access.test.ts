import { describe, expect, it } from "vitest";
import {
  createOrderPaymentAccessToken,
  verifyOrderPaymentAccessToken
} from "./order-payment-access";

describe("online order payment access", () => {
  it("creates a bearer token that is verified only against its stored hash", () => {
    const access = createOrderPaymentAccessToken();

    expect(access.token).toHaveLength(43);
    expect(access.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyOrderPaymentAccessToken(access.token, access.hash)).toBe(true);
    expect(verifyOrderPaymentAccessToken(`${access.token}x`, access.hash)).toBe(false);
    expect(verifyOrderPaymentAccessToken(access.token, null)).toBe(false);
    expect(verifyOrderPaymentAccessToken(access.token, "invalid-hash")).toBe(false);
  });
});
