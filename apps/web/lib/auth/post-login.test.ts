import { describe, expect, it } from "vitest";
import { resolvePostLoginPath, safeNextPath } from "./post-login";

describe("post-login routing", () => {
  it("keeps only same-site return paths", () => {
    expect(safeNextPath("/account/orders")).toBe("/account/orders");
    expect(safeNextPath("//attacker.example")).toBeNull();
    expect(safeNextPath("https://attacker.example")).toBeNull();
  });

  it("sends customers, cashiers, and operational staff to the right workspace", () => {
    expect(resolvePostLoginPath({ userId: "customer", roles: ["CUSTOMER"], permissions: [] })).toBe("/account");
    expect(resolvePostLoginPath({ userId: "cashier", roles: ["CASHIER"], permissions: ["orders.create"] })).toBe("/pos");
    expect(resolvePostLoginPath({ userId: "manager", roles: ["STORE_MANAGER"], permissions: ["orders.read"] })).toBe("/business-center");
  });

  it("preserves a safe requested destination", () => {
    expect(resolvePostLoginPath({ userId: "customer", roles: ["CUSTOMER"], permissions: [] }, "/account/wishlist")).toBe("/account/wishlist");
  });
});
