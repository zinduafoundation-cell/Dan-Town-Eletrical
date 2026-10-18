import { BusinessDocumentSettingsEditor } from "@/components/admin/business-document-settings-editor";
import { PortalShell } from "@/app/portal-shell";
import { requireAuthorizedPermission } from "@/lib/auth/server";
import { defaultBusinessDocumentSettings } from "@/lib/documents/business-document-settings";
import { loadBusinessConfiguration } from "@/lib/settings/business-configuration";

export const dynamic = "force-dynamic";

export default async function BusinessDocumentsPage() {
  const context = await requireAuthorizedPermission("settings.manage");
  let initialSettings = defaultBusinessDocumentSettings;
  let initialUpdatedAt: string | null = null;
  let migrationReady = true;
  let initialMessage = "";
  try {
    const configuration = await loadBusinessConfiguration();
    initialSettings = configuration.documentSettings;
    initialUpdatedAt = configuration.updatedAt;
  } catch (error) {
    console.error("Business document settings table is unavailable.", error);
    migrationReady = false;
    initialMessage = "Business settings could not be loaded. Confirm the database migration and saved configuration.";
  }
  return (
    <PortalShell
      title="Invoice & receipt design."
      description="Set the shared branding and visible fields for POS receipts and customer payment receipts."
      roles={context.roles}
      permissions={context.permissions}
      links={[
        { label: "Overview", href: "/admin" },
        { label: "Settings", href: "/admin/settings", permission: "settings.manage" },
        { label: "Documents", href: "/admin/settings/documents", permission: "settings.manage" },
        { label: "Payments", href: "/admin/payments", permission: "payments.read" },
      ]}
    >
      <BusinessDocumentSettingsEditor initialSettings={initialSettings} initialUpdatedAt={initialUpdatedAt} migrationReady={migrationReady} initialMessage={initialMessage} />
    </PortalShell>
  );
}
