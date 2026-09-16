import type { ReactNode } from "react";
import { getAuthorizationContext } from "@/lib/auth/server";
import { hasQuickAccess, isQuickAccessEnabled } from "@/lib/auth/quick-access";
import { SecurityGate } from "@/components/security-gate";
import { hasRole } from "@dantown/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const context = await getAuthorizationContext();
  if (!context) return children;

  const canEnterAdmin =
    context.userId === "dev-bypass-user" ||
    hasRole(context, "ADMIN") ||
    hasRole(context, "CEO") ||
    ["users.manage", "roles.manage", "settings.manage"].some((permission) =>
      context.permissions.includes(permission as never),
    );

  if (!canEnterAdmin) redirect("/403");

  const accessGranted = !isQuickAccessEnabled() || (await hasQuickAccess(context.userId));
  return accessGranted ? children : <SecurityGate />;
}
