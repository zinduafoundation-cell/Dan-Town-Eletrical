import { describe, expect, it } from "vitest";
import { parseSmartLine, quickCash, whatsappUrl } from "./smart";

describe("POS smart register helpers", () => {
  it.each([
    ["5 2.5mm cable", { qty: 5, query: "2.5mm cable" }],
    ["5x cable", { qty: 5, query: "cable" }],
    ["cable x5", { qty: 5, query: "cable" }],
    ["2.5 mm cable", { qty: 1, query: "2.5 mm cable" }],
  ])("parses smart product entry %s", (input, expected) => {
    expect(parseSmartLine(input)).toEqual(expected);
  });

  it("suggests exact cash and progressively larger notes", () => {
    expect(quickCash(137)).toEqual([137, 150, 200, 500]);
  });

  it("normalizes a Kenyan customer phone for WhatsApp receipts", () => {
    expect(whatsappUrl("0712 345 678", "Thanks")).toBe("https://wa.me/254712345678?text=Thanks");
  });
});
