import { describe, expect, it } from "vitest";
import { isSidebarLinkActive } from "./responsive-sidebar";

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
});
