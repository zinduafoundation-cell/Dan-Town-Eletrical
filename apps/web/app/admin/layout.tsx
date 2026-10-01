import type { ReactNode } from "react";
import { getAuthorizationContext, isBskAccount, shouldBypassAuth } from "@/lib/auth/server";
import { hasQuickAccess, isQuickAccessEnabled } from "@/lib/auth/quick-access";
import { SecurityGate } from "@/components/security-gate";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const context = await getAuthorizationContext();
  if (!context) return children;

  const isBypassUser = shouldBypassAuth() && context.userId === "dev-bypass-user";
  const canEnterAdmin = isBypassUser || (await isBskAccount());

  if (!canEnterAdmin) redirect("/403");

  const accessGranted = !isQuickAccessEnabled() || (await hasQuickAccess(context.userId));
  return accessGranted ? children : <SecurityGate />;
}
