import { describe, expect, it } from "vitest";
import { defaultAccountLinks, storefrontPrimaryLinks } from "./account-navigation";

describe("storefront account navigation", () => {
  it("includes the customer orders page in the default signed-in menu", () => {
    expect(defaultAccountLinks.some((link) => link.href === "/account/orders")).toBe(true);
    expect(defaultAccountLinks.some((link) => link.href === "/account")).toBe(true);
  });

  it("adds a direct Dantown Centre link to the storefront navigation", () => {
    expect(storefrontPrimaryLinks.some((link) => link.href === "/business-center" && link.label === "Dantown Centre")).toBe(true);
    expect(storefrontPrimaryLinks.some((link) => link.href === "/shop")).toBe(true);
  });
});
