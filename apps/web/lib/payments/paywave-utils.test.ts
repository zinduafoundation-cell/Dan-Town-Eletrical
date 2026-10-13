import { describe, expect, it } from "vitest";
import { matchesKshAmount, normalizeKenyanPhone, toKshAmount } from "./paywave-utils";

describe("Paywave payment utilities", () => {
  it.each([
    ["0712345678", "254712345678"],
    ["0112345678", "254112345678"],
    ["+254 712 345 678", "254712345678"],
    ["254112345678", "254112345678"],
  ])("normalizes Kenyan phone number %s", (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it.each(["071234567", "0812345678", "+1 415 555 2671", "2547123456789"])(
    "rejects invalid Kenyan phone number %s",
    (input) => {
      expect(() => normalizeKenyanPhone(input)).toThrow("Enter a valid Kenyan M-Pesa mobile number.");
    },
  );

  it("formats positive KES amounts to two decimal places", () => {
    expect(toKshAmount(125)).toBe("125.00");
    expect(toKshAmount(12.5)).toBe("12.50");
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid payment amount %s", (amount) => {
    expect(() => toKshAmount(amount)).toThrow("Paywave Express payments must be at least KSh 1.");
  });

  it("compares amounts at currency precision", () => {
    expect(matchesKshAmount("125.00", 125)).toBe(true);
    expect(matchesKshAmount(125.001, 125)).toBe(true);
    expect(matchesKshAmount("125.01", 125)).toBe(false);
    expect(matchesKshAmount("not-an-amount", 125)).toBe(false);
  });
});
