import { describe, expect, it } from "vitest";
import { pesapalPaymentMethod } from "./pesapal-utils";

describe("pesapalPaymentMethod", () => {
  it.each([
    ["M-PESA", "MPESA"],
    ["Mpesa", "MPESA"],
    ["VISA", "CARD"],
    ["Mastercard", "CARD"],
    ["Bank Transfer", "BANK_TRANSFER"],
  ] as const)("maps provider method %s to %s", (providerMethod, expected) => {
    expect(pesapalPaymentMethod(providerMethod)).toBe(expected);
  });

  it("rejects methods it cannot safely classify", () => {
    expect(pesapalPaymentMethod(undefined)).toBeNull();
    expect(pesapalPaymentMethod("Unknown tender")).toBeNull();
  });
});
