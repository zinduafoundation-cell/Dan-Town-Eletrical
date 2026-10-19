import { notFound } from "next/navigation";
import { PortalShell } from "@/app/portal-shell";
import { SettingsCategoryWorkspace } from "@/components/admin/settings-category-workspace";
import { requireAuthorizedPermission } from "@/lib/auth/server";
import { loadPaymentProviderReadiness, loadPaymentProviderSettings } from "@/lib/payments/payment-provider-settings";
import { findSettingsCategory } from "@/lib/settings/categories";

export const dynamic = "force-dynamic";

export default async function SettingsCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const context = await requireAuthorizedPermission("users.read");
  const { category: slug } = await params;
  const category = findSettingsCategory(slug);
  if (!category) notFound();
  const paymentSettings = slug === "payments-and-finance" && context.permissions.includes("settings.manage")
    ? await loadPaymentProviderSettings()
    : null;
  const paymentReadiness = paymentSettings
    ? await loadPaymentProviderReadiness(paymentSettings.settings)
    : null;

  return <PortalShell
    title={`${category.title}.`}
    description={category.description}
    roles={context.roles}
    permissions={context.permissions}
    links={[
      { label: "Overview", href: "/admin" },
      { label: "Settings", href: "/admin/settings", permission: "users.read" },
      { label: "Team", href: "/admin/team", permission: "users.read" },
      { label: "Dantown Centre", href: "/centre", permission: "reports.read" },
    ]}
  >
    <SettingsCategoryWorkspace
      category={category}
      permissions={context.permissions}
      paymentSettings={paymentSettings}
      paymentReadiness={paymentReadiness}
    />
  </PortalShell>;
}
