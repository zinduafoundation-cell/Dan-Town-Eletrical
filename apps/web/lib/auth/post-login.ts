import type { AuthorizationContext } from "@dantown/auth";
import type { Permission, UserRole } from "@dantown/shared";

const CENTRE_ROLES: UserRole[] = [
  "CEO",
  "ADMIN",
  "SALES_MANAGER",
  "STORE_MANAGER",
  "INVENTORY_MANAGER",
  "ACCOUNTANT",
  "PROCUREMENT",
  "SALES_AGENT",
];

const CENTRE_PERMISSIONS: Permission[] = [
  "orders.read",
  "inventory.read",
  "users.read",
  "reports.read",
];

export function safeNextPath(value: string | null | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

/**
 * Direct each authenticated person to the Dantown area that their server-side
 * role permits. An explicit same-site destination always takes precedence.
 */
export function resolvePostLoginPath(context: AuthorizationContext | null, requestedNext?: string | null) {
  const next = safeNextPath(requestedNext);
  if (next) return next;
  if (!context) return "/account";

  if (
    context.roles.some((role) => CENTRE_ROLES.includes(role)) ||
    CENTRE_PERMISSIONS.some((permission) => context.permissions.includes(permission))
  ) {
    return "/business-center";
  }

  if (context.roles.includes("CASHIER") || context.permissions.includes("orders.create")) {
    return "/pos";
  }

  return "/account";
}
