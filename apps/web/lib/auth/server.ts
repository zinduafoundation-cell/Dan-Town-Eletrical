import { hasPermission, hasRole, requirePermission, requireRole } from "@dantown/auth";
import type { AuthorizationContext } from "@dantown/auth";
import { permissions, type Permission, type UserRole } from "@dantown/shared";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, createSupabaseServiceClient } from "../supabase/server";

export const BSK_ACCOUNT_EMAIL = "dluxsolars@gmail.com";

const BSK_PROTECTED_PERMISSIONS = new Set<Permission>([
  "users.read",
  "users.create",
  "users.update",
  "users.delete",
  "roles.read",
  "roles.manage",
  "settings.manage",
  "audit_logs.read",
  "audit_logs.write",
  "permissions.manage",
  "finance.read"
]);

export function isBskEmailAddress(email?: string | null) {
  return email?.toLowerCase() === BSK_ACCOUNT_EMAIL;
}

export function isBskProtectedPermission(permission: Permission | string) {
  return BSK_PROTECTED_PERMISSIONS.has(permission as Permission);
}

export function shouldBypassAuth() {
  if (process.env.NODE_ENV !== "development") return false;

  const override = process.env.NEXT_PUBLIC_ALLOW_AUTH_BYPASS;
  if (override === undefined) return false;

  return !["0", "false", "no", "off", "disabled"].includes(override.toLowerCase());
}

export function getBskOwnerAuthorizationContext(userId: string): AuthorizationContext {
  return {
    userId,
    roles: ["CEO", "ADMIN"],
    permissions: [...permissions]
  };
}

export async function isBskAccount() {
  if (shouldBypassAuth()) return true;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return isBskEmailAddress(user?.email);
}

export async function getAuthorizationContext(): Promise<AuthorizationContext | null> {
  if (shouldBypassAuth()) {
    return {
      userId: "dev-bypass-user",
      roles: ["ADMIN", "CEO"],
      permissions: [...permissions]
    };
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    if (typeof error === "object" && error && "message" in error && typeof (error as { message?: string }).message === "string" && (error as { message: string }).message.includes("request scope")) {
      return null;
    }
    throw error;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (isBskEmailAddress(user.email)) {
    return getBskOwnerAuthorizationContext(user.id);
  }

  const { data: assignments } = await supabase.from("user_roles").select("role_id").eq("user_id", user.id);
  const roleIds = (assignments ?? []).map((assignment) => assignment.role_id);
  if (!roleIds.length) return { userId: user.id, roles: [], permissions: [] };
  const [{ data: roleRows }, { data: rolePermissionRows }] = await Promise.all([
    supabase.from("roles").select("code").in("id", roleIds),
    supabase.from("role_permissions").select("permission_id").in("role_id", roleIds)
  ]);
  const permissionIds = (rolePermissionRows ?? []).map((item) => item.permission_id);
  const { data: permissionRows } = permissionIds.length
    ? await supabase.from("permissions").select("code").in("id", permissionIds)
    : { data: [] };
  return {
    userId: user.id,
    roles: (roleRows ?? []).map((row) => row.code as UserRole),
    permissions: (permissionRows ?? []).map((row) => row.code as Permission)
  };
}

export async function requireAuthenticated() {
  const context = await getAuthorizationContext();
  if (shouldBypassAuth()) return context ?? {
    userId: "dev-bypass-user",
    roles: ["ADMIN", "CEO"],
    permissions: [...permissions]
  };
  if (!context) redirect("/login");
  return context;
}

export async function getStaffIdentity(context: AuthorizationContext) {
  if (context.userId === "dev-bypass-user") return { userId: null, name: "Development Operator", role: context.roles[0] ?? "ADMIN" };
  const supabase = createSupabaseServiceClient();
  const [{ data: profile }, { data: user }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", context.userId).maybeSingle(),
    supabase.auth.admin.getUserById(context.userId)
  ]);
  return { userId: context.userId, name: profile?.full_name || user.user?.email || "Dantown Staff", role: context.roles[0] ?? "STAFF" };
}

export async function getPermissionGuard(permission: Permission) {
  const context = await getAuthorizationContext();

  if (shouldBypassAuth() || context?.userId === "dev-bypass-user") {
    return { ok: true, status: 200, message: "Authorized", context: context ?? {
      userId: "dev-bypass-user",
      roles: ["ADMIN", "CEO"],
      permissions: [...permissions]
    } };
  }

  if (!context) {
    return { ok: false, status: 401, message: "Authentication required." };
  }

  if (isBskProtectedPermission(permission) && !(await isBskAccount())) {
    return { ok: false, status: 403, message: "Only the BSK account can access this protected workspace." };
  }

  if (!hasPermission(context, permission)) {
    return { ok: false, status: 403, message: `You don't have permission to access this resource.` };
  }

  return { ok: true, status: 200, message: "Authorized", context };
}

export async function requireAuthorizedPermission(permission: Permission) {
  const guard = await getPermissionGuard(permission);
  if (!guard.ok) {
    if (guard.status === 401) redirect("/login");
    redirect("/403");
  }
  return guard.context ?? await requireAuthenticated();
}

export async function getRoleGuard(role: UserRole) {
  const context = await getAuthorizationContext();

  if (shouldBypassAuth() || context?.userId === "dev-bypass-user") {
    return { ok: true, status: 200, message: "Authorized", context: context ?? {
      userId: "dev-bypass-user",
      roles: ["ADMIN", "CEO"],
      permissions: [...permissions]
    } };
  }

  if (!context) {
    return { ok: false, status: 401, message: "Authentication required." };
  }

  if ((role === "ADMIN" || role === "CEO") && !(await isBskAccount())) {
    return { ok: false, status: 403, message: "Only the BSK account can access this protected workspace." };
  }

  if (!hasRole(context, role)) {
    return { ok: false, status: 403, message: `You don't have permission to access this resource.` };
  }

  return { ok: true, status: 200, message: "Authorized", context };
}

export async function requireAuthorizedRole(role: UserRole) {
  const guard = await getRoleGuard(role);
  if (!guard.ok) {
    if (guard.status === 401) redirect("/login");
    redirect("/403");
  }
  return guard.context ?? await requireAuthenticated();
}

export { requirePermission, requireRole };
