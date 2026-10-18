import { requireAuthorizedPermission } from "@/lib/auth/server";
import { PortalShell } from "@/app/portal-shell";
import { NotificationPreferences } from "@/components/admin/notification-preferences";
import { SettingsDashboard } from "@/components/admin/settings-dashboard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const context = await requireAuthorizedPermission("users.read");
  return <PortalShell
    title="Settings."
    description="A searchable control centre connected to the business workspaces and settings already used by Dantown."
    roles={context.roles}
    permissions={context.permissions}
    links={[
      { label: "Overview", href: "/admin" },
      { label: "Settings", href: "/admin/settings" },
      { label: "Team", href: "/admin/team", permission: "users.read" },
      { label: "Automation", href: "/admin/automation", permission: "automation.read" },
      { label: "POS", href: "/pos", permission: "orders.read" },
    ]}
  >
    <SettingsDashboard permissions={context.permissions} />
    <div id="notifications"><NotificationPreferences /></div>
  </PortalShell>;
}
