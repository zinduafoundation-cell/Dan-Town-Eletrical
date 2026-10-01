import { describe, expect, it } from "vitest";
import { hasPermission, hasRole, requirePermission } from "@dantown/auth";
import type { AuthorizationContext } from "@dantown/auth";
import {
  getBskOwnerAuthorizationContext,
  getPermissionGuard,
  isBskEmailAddress,
  isBskProtectedPermission,
  shouldBypassAuth
} from "./server";

const customer: AuthorizationContext = { userId: "customer-a", roles: ["CUSTOMER"], permissions: [] };
const cashier: AuthorizationContext = { userId: "cashier-a", roles: ["CASHIER"], permissions: ["orders.read", "orders.create"] };
const ceo: AuthorizationContext = { userId: "ceo-a", roles: ["CEO"], permissions: ["users.manage", "finance.read"] };

describe("authorization boundaries", () => {
  it("isolates customer and executive roles", () => {
    expect(hasRole(customer, "ADMIN")).toBe(false);
    expect(hasRole(ceo, "CEO")).toBe(true);
    expect(hasPermission(customer, "orders.read")).toBe(false);
  });

  it("rejects cashier inventory and product management", () => {
    expect(() => requirePermission(cashier, "inventory.adjust")).toThrow("You don't have permission");
    expect(() => requirePermission(cashier, "products.delete")).toThrow("You don't have permission");
  });

  it("keeps finance permission explicit", () => {
    expect(hasPermission(cashier, "finance.read")).toBe(false);
    expect(hasPermission(ceo, "finance.read")).toBe(true);
  });

  it("recognizes the only BSK email for protected access", () => {
    expect(isBskEmailAddress("dluxsolars@gmail.com")).toBe(true);
    expect(isBskEmailAddress("someone@example.com")).toBe(false);
    expect(isBskEmailAddress(null)).toBe(false);
  });

  it("treats admin and role management permissions as BSK-only protected access", () => {
    expect(isBskProtectedPermission("users.read")).toBe(true);
    expect(isBskProtectedPermission("users.create")).toBe(true);
    expect(isBskProtectedPermission("roles.manage")).toBe(true);
    expect(isBskProtectedPermission("orders.read")).toBe(false);
    expect(isBskProtectedPermission("inventory.read")).toBe(false);
  });

  it("gives the BSK owner account full executive access and all permissions", () => {
    const context = getBskOwnerAuthorizationContext("owner-user-id");

    expect(context.roles).toEqual(["CEO", "ADMIN"]);
    expect(context.permissions).toContain("users.read");
    expect(context.permissions).toContain("finance.read");
    expect(context.permissions).toContain("settings.manage");
    expect(hasRole(context, "CEO")).toBe(true);
    expect(hasPermission(context, "orders.read")).toBe(true);
  });

  it("allows local development auth bypass only when explicitly enabled", () => {
    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = env.NODE_ENV;
    const previousOverride = env.NEXT_PUBLIC_ALLOW_AUTH_BYPASS;

    env.NODE_ENV = "development";
    delete env.NEXT_PUBLIC_ALLOW_AUTH_BYPASS;
    expect(shouldBypassAuth()).toBe(false);

    env.NEXT_PUBLIC_ALLOW_AUTH_BYPASS = "true";
    expect(shouldBypassAuth()).toBe(true);

    env.NEXT_PUBLIC_ALLOW_AUTH_BYPASS = "false";
    expect(shouldBypassAuth()).toBe(false);

    env.NODE_ENV = "production";
    expect(shouldBypassAuth()).toBe(false);

    delete env.NEXT_PUBLIC_ALLOW_AUTH_BYPASS;
    env.NODE_ENV = previousNodeEnv;

    if (previousOverride === undefined) {
      delete env.NEXT_PUBLIC_ALLOW_AUTH_BYPASS;
    } else {
      env.NEXT_PUBLIC_ALLOW_AUTH_BYPASS = previousOverride;
    }
  });

  it("returns structured auth results for API access checks", async () => {
    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = env.NODE_ENV;
    const previousOverride = env.NEXT_PUBLIC_ALLOW_AUTH_BYPASS;
    const previousSupabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const previousSupabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    env.NODE_ENV = "development";
    env.NEXT_PUBLIC_ALLOW_AUTH_BYPASS = "false";
    env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    try {
      const result = await getPermissionGuard("orders.read");
      expect(result.ok).toBe(false);
      expect(result.status).toBe(401);
      expect(result.message).toMatch(/authentication|required/i);
    } finally {
      env.NODE_ENV = previousNodeEnv;

      if (previousOverride === undefined) {
        delete env.NEXT_PUBLIC_ALLOW_AUTH_BYPASS;
      } else {
        env.NEXT_PUBLIC_ALLOW_AUTH_BYPASS = previousOverride;
      }
      if (previousSupabaseUrl === undefined) {
        delete env.NEXT_PUBLIC_SUPABASE_URL;
      } else {
        env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
      }
      if (previousSupabaseAnonKey === undefined) {
        delete env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      } else {
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousSupabaseAnonKey;
      }
    }
  });
});
