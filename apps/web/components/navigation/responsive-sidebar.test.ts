import { describe, expect, it } from "vitest";
import { isSidebarGroupActive, isSidebarLinkActive, type SidebarLink } from "./responsive-sidebar";

describe("isSidebarLinkActive", () => {
  it("matches the current route and nested pages", () => {
    expect(isSidebarLinkActive("/pos", "/pos")).toBe(true);
    expect(isSidebarLinkActive("/pos/new-sale", "/pos")).toBe(true);
  });

  it("does not match unrelated routes or prefix collisions", () => {
    expect(isSidebarLinkActive("/positional", "/pos")).toBe(false);
    expect(isSidebarLinkActive("/account", "/pos")).toBe(false);
  });

  it("only matches the root link on the root route", () => {
    expect(isSidebarLinkActive("/", "/")).toBe(true);
    expect(isSidebarLinkActive("/shop", "/")).toBe(false);
  });

  it("matches a filtered route only when its query values are active", () => {
    const filteredRoute = "/admin/documents?group=SALES&type=INVOICE";
    expect(isSidebarLinkActive("/admin/documents", filteredRoute, "?group=SALES&type=INVOICE")).toBe(true);
    expect(isSidebarLinkActive("/admin/documents", filteredRoute, "?group=SALES&type=QUOTATION")).toBe(false);
    expect(isSidebarLinkActive("/admin/documents", filteredRoute, "")).toBe(false);
  });

  it("activates a parent group when one of its filtered children is active", () => {
    const children: SidebarLink[] = [
      { label: "Invoices", href: "/admin/documents?group=SALES&type=INVOICE", icon: "Receipt" },
      { label: "Purchase orders", href: "/admin/documents?group=PURCHASES&type=PURCHASE_ORDER", icon: "ShoppingCart" },
    ];
    expect(isSidebarGroupActive("/admin/documents", children, "?group=PURCHASES&type=PURCHASE_ORDER")).toBe(true);
    expect(isSidebarGroupActive("/admin/documents", children, "?group=SALES&type=QUOTATION")).toBe(false);
  });
});
