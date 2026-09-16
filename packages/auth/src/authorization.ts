import type { Permission, UserRole } from "@dantown/shared";

export type AuthorizationContext = { userId: string; roles: UserRole[]; permissions: Permission[] };

export function hasRole(context: AuthorizationContext, role: UserRole) {
  return context.roles.includes(role);
}

export function hasPermission(context: AuthorizationContext, permission: Permission) {
  return context.permissions.includes(permission);
}

export function requireRole(context: AuthorizationContext, role: UserRole) {
  if (!hasRole(context, role)) throw new AuthorizationError();
  return context;
}

export function requirePermission(context: AuthorizationContext, permission: Permission) {
  if (!hasPermission(context, permission)) throw new AuthorizationError();
  return context;
}

export class AuthorizationError extends Error {
  status = 403;
  constructor() { super("You don't have permission to access this area."); }
}
