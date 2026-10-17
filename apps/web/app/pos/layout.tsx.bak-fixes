import { centreAppMetadata } from "@/lib/centre/pwa";
import type { ReactNode } from "react";
import { requireAuthorizedPermission, getStaffIdentity } from "@/lib/auth/server";
import { hasBusinessCenterAccess } from "@/lib/auth/business-center-access";
import { POSShell } from "@/components/pos/pos-shell";
import "../styles/pos-premium.css";
import "../styles/pos-glass.css";
export const dynamic = "force-dynamic";

export default async function POSLayout({ children }: { children: ReactNode }) {
  const context = await requireAuthorizedPermission("orders.create");
  const staffIdentity = await getStaffIdentity(context);
  const centreAuthorized = await hasBusinessCenterAccess(context.userId);

  return (
    <POSShell permissions={context.permissions} staffUserId={staffIdentity.userId} centreAuthorized={centreAuthorized} staffName={staffIdentity.name} staffRole={staffIdentity.role}>
      {children}
    </POSShell>
  );
}

export const metadata = centreAppMetadata;
