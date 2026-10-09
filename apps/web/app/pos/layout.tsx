import type { ReactNode } from "react";
import { requireAuthorizedPermission, getStaffIdentity } from "@/lib/auth/server";
import { POSShell } from "@/components/pos/pos-shell";
import "../styles/pos-premium.css";
import "../styles/pos-glass.css";
export const dynamic = "force-dynamic";

export default async function POSLayout({ children }: { children: ReactNode }) {
  const context = await requireAuthorizedPermission("orders.create");
  const staffIdentity = await getStaffIdentity(context);

  return (
    <POSShell permissions={context.permissions} staffName={staffIdentity.name} staffRole={staffIdentity.role}>
      {children}
    </POSShell>
  );
}
