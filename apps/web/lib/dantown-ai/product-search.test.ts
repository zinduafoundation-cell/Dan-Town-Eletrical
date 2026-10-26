import { describe, expect, it } from "vitest";
import { scoreProductMatch } from "./product-search";

const product = {
  name: "Copper Electrical Cable 2.5mm",
  sku: "CAB-25-CU",
  short_description: "Twin and earth cable",
  brandName: "Dantown",
  categoryName: "Electrical Cables",
  tags: ["wire", "copper conductor"],
};

describe("scoreProductMatch", () => {
  it("matches product identity and catalogue terms", () => {
    expect(scoreProductMatch(product, "Copper Electrical Cable 2.5mm")).toBe(1);
    expect(scoreProductMatch({ ...product, tags: [] }, "copper wire")).toBeGreaterThanOrEqual(0.82);
  });

  it("tolerates a single-character spelling error without turning it into an exact match", () => {
    expect(scoreProductMatch({ ...product, name: "20A Light Switch", sku: "SW-20A" }, "light swith")).toBeGreaterThan(0.5);
    expect(scoreProductMatch({ ...product, name: "20A Light Switch", sku: "SW-20A" }, "light swith")).toBeLessThan(1);
  });

  it("matches common plural trade terms", () => {
    expect(scoreProductMatch({ ...product, name: "20A Light Switch", sku: "SW-20A" }, "switches")).toBeGreaterThan(0.8);
    expect(scoreProductMatch({ ...product, name: "12V Battery", sku: "BAT-12V" }, "batteries")).toBeGreaterThan(0.8);
  });

  it("does not match unrelated terms", () => {
    expect(scoreProductMatch(product, "solar battery")).toBe(0);
  });
});
