import { BusinessDocumentSettingsEditor } from "@/components/admin/business-document-settings-editor";
import { PortalShell } from "@/app/portal-shell";
import { requireAuthorizedPermission } from "@/lib/auth/server";
import { defaultBusinessDocumentSettings, businessDocumentSettingsSchema } from "@/lib/documents/business-document-settings";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BusinessDocumentsPage() {
  const context = await requireAuthorizedPermission("settings.manage");
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("business_document_settings")
    .select("template")
    .eq("id", "dantown")
    .maybeSingle();
  if (error) console.error("Business document settings table is unavailable.", error);
  const parsed = businessDocumentSettingsSchema.safeParse(data?.template);
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
      <BusinessDocumentSettingsEditor initialSettings={parsed.success ? parsed.data : defaultBusinessDocumentSettings} migrationReady={!error} />
    </PortalShell>
  );
}
