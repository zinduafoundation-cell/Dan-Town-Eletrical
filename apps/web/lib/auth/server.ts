import { hasPermission, hasRole, requirePermission, requireRole } from "@dantown/auth";
import type { AuthorizationContext } from "@dantown/auth";
import { permissions, type Permission, type UserRole } from "@dantown/shared";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, createSupabaseServiceClient } from "../supabase/server";

export const BSK_ACCOUNT_EMAIL = "dluxsolars@gmail.com";

export function shouldBypassAuth() {
  if (process.env.NODE_ENV !== "development") return false;
  const override = process.env.NEXT_PUBLIC_ALLOW_AUTH_BYPASS;
  if (override !== undefined) {
    return ["1", "true", "yes", "on"].includes(override.toLowerCase());
  }

  return process.env.NODE_ENV === "development";
}

export async function isBskAccount() {
  if (shouldBypassAuth()) return true;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email?.toLowerCase() === BSK_ACCOUNT_EMAIL;
}

export async function getAuthorizationContext(): Promise<AuthorizationContext | null> {
  if (shouldBypassAuth()) {
    return {
      userId: "dev-bypass-user",
      roles: ["ADMIN", "CEO"],
      permissions: [...permissions]
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

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

export async function requireAuthorizedPermission(permission: Permission) {
  const context = await requireAuthenticated();
  if (shouldBypassAuth()) return context;
  if (!hasPermission(context, permission)) redirect("/403");
  return context;
}

export async function requireAuthorizedRole(role: UserRole) {
  const context = await requireAuthenticated();
  if (shouldBypassAuth()) return context;
  if (!hasRole(context, role)) redirect("/403");
  return context;
}

export { requirePermission, requireRole };
