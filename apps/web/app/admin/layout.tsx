import type { ReactNode } from "react";
import { getAuthorizationContext, isBskAccount, shouldBypassAuth } from "@/lib/auth/server";
import { hasQuickAccess, isPinConfigured, isQuickAccessEnabled } from "@/lib/auth/quick-access";
import { SecurityGate } from "@/components/security-gate";
import { redirect } from "next/navigation";
import { userHasPasskey } from "@/lib/auth/passkeys";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const context = await getAuthorizationContext();
  if (!context) return children;

  const isBypassUser = shouldBypassAuth() && context.userId === "dev-bypass-user";
  const canEnterAdmin = isBypassUser || (await isBskAccount());

  if (!canEnterAdmin) redirect("/403");

  const accessGranted = !isQuickAccessEnabled() || (await hasQuickAccess(context.userId));
  if (accessGranted) return children;
  const hasBiometric = context.userId !== "dev-bypass-user" && (await userHasPasskey(context.userId));
  return <SecurityGate pinEnabled={isPinConfigured()} hasBiometric={hasBiometric} />;
}
