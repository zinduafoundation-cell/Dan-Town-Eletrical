import { describe, expect, it } from "vitest";
import { defaultAccountLinks, storefrontPrimaryLinks } from "./account-navigation";

describe("storefront account navigation", () => {
  it("includes the customer orders page in the default signed-in menu", () => {
    expect(defaultAccountLinks.some((link) => link.href === "/account/orders")).toBe(true);
    expect(defaultAccountLinks.some((link) => link.href === "/account")).toBe(true);
  });

  it("keeps the private Dantown Centre out of storefront navigation", () => {
    expect(storefrontPrimaryLinks.some((link) => link.href === "/business-center")).toBe(false);
    expect(storefrontPrimaryLinks.some((link) => link.href === "/shop")).toBe(true);
  });
});
