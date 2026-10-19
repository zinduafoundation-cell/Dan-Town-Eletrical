import type { AuthorizationContext } from "@dantown/auth";
import type { Permission } from "@dantown/shared";
import type { AiIntent } from "./intent";

export type AiSurface = "storefront" | "centre" | "pos" | "admin";

export const SURFACE_PERMISSIONS: Record<AiSurface, Permission[]> = {
  storefront: [],
  centre: ["orders.read", "inventory.read", "reports.read", "payments.read", "settings.manage", "customers.read", "products.read", "quotes.read"],
  pos: ["orders.create", "orders.read", "inventory.read", "customers.read", "payments.read"],
  admin: ["users.read", "reports.read", "settings.manage", "finance.read", "automation.read", "orders.read", "inventory.read", "customers.read", "products.read", "quotes.read"]
};

export const SURFACE_INTENTS: Record<AiSurface, AiIntent[]> = {
  storefront: ["products", "categories", "business", "inventory", "orders", "quotes", "payments", "documents"],
  centre: ["sales", "inventory", "business", "products", "categories", "settings", "payments", "orders", "quotes", "documents", "customers", "suppliers"],
  pos: ["products", "inventory", "categories", "business", "payments"],
  admin: ["sales", "inventory", "products", "categories", "business", "orders", "quotes", "settings", "payments", "documents", "customers", "suppliers"]
};

export function aiSurfaceFor(pathname = ""): AiSurface {
  const value = pathname.toLowerCase();
  if (/\/admin(?:\/|$)/.test(value)) return "admin";
  if (/\/business-center(?:\/|$)|\/centre(?:\/|$)/.test(value)) return "centre";
  if (/\/pos(?:\/|$)/.test(value)) return "pos";
  return "storefront";
}

export function isSurfaceIntentAllowed(surface: AiSurface, intent: AiIntent) {
  return SURFACE_INTENTS[surface].includes(intent);
}

export function isSurfaceAllowed(surface: AiSurface, context: AuthorizationContext | null) {
  if (surface === "storefront") return true;
  if (!context) return false;

  if (surface === "centre") {
    return SURFACE_PERMISSIONS.centre.some((permission) => context.permissions.includes(permission))
      || ["ADMIN", "CEO", "SALES_MANAGER", "STORE_MANAGER", "INVENTORY_MANAGER"].some((role) => context.roles.includes(role as never));
  }

  if (surface === "pos") {
    return SURFACE_PERMISSIONS.pos.some((permission) => context.permissions.includes(permission))
      || ["ADMIN", "CEO", "STORE_MANAGER", "CASHIER", "SALES_MANAGER"].some((role) => context.roles.includes(role as never));
  }

  if (surface === "admin") {
    return SURFACE_PERMISSIONS.admin.some((permission) => context.permissions.includes(permission))
      || ["ADMIN", "CEO"].some((role) => context.roles.includes(role as never));
  }

  return false;
}
