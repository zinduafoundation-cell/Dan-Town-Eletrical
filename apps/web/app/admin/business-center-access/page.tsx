import { PortalShell } from "@/app/portal-shell";
import { BusinessCenterAccessManager } from "@/components/admin/business-center-access-manager";
import { requireAuthorizedPermission } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BusinessCenterAccessPage() {
  const context = await requireAuthorizedPermission("users.manage");
  const supabase = createSupabaseServiceClient();
  const { data: accounts, error } = await supabase
    .from("business_center_access")
    .select("user_id, email, approved_at")
    .order("approved_at", { ascending: false });
  if (error) {
    console.error("Business Centre access page query failed", error);
    throw new Error("Unable to load approved Business Centre accounts.");
  }

  return (
    <PortalShell
      title="Business Centre access"
      description="Approve and revoke individual accounts that can open the private Centre."
      roles={context.roles}
      permissions={context.permissions}
      links={[
        { label: "Business Centre access", href: "/admin/business-center-access" },
        { label: "Team", href: "/admin/team" }
      ]}
    >
      <BusinessCenterAccessManager initialAccounts={accounts ?? []} />
    </PortalShell>
  );
}
