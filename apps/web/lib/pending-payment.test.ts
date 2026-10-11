import { describe, expect, it } from "vitest";
import { getPaymentAccessTokenFromLocation } from "./pending-payment";

describe("getPaymentAccessTokenFromLocation", () => {
  const token = "A".repeat(43);

  it("reads the payment token from the URL fragment", () => {
    expect(getPaymentAccessTokenFromLocation(`#paymentToken=${token}`)).toBe(token);
  });

  it("uses the saved reminder token when the URL has no token", () => {
    expect(getPaymentAccessTokenFromLocation("", token)).toBe(token);
  });

  it("rejects missing or malformed tokens", () => {
    expect(getPaymentAccessTokenFromLocation("")).toBe("");
    expect(getPaymentAccessTokenFromLocation("#paymentToken=short", token)).toBe(token);
    expect(getPaymentAccessTokenFromLocation("#paymentToken=short")).toBe("");
  });
});
