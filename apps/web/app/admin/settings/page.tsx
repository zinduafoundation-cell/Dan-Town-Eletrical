import { requireAuthorizedPermission } from "../../../lib/auth/server";
import { PortalShell } from "../../portal-shell";
import Link from "next/link";
import { Bell, Building2, CreditCard, Database, LockKeyhole, Package, Settings2, Users, Zap } from "lucide-react";
import { NotificationPreferences } from "@/components/admin/notification-preferences";

export const dynamic = "force-dynamic";

const settings = [
  ["Business profile", "Business identity, contacts, location, currency, and timezone.", Building2, "Configured through the existing business profile and environment settings."],
  ["Product and inventory", "Catalog status, stock policy, barcode behavior, and reorder defaults.", Package, "Product and inventory records already use Supabase as the source of truth."],
  ["POS and payments", "Register behavior, payment methods, receipts, and offline operation.", CreditCard, "POS checkout, Paystack, and offline queue are already connected."],
  ["Users and permissions", "Team members, roles, and permission assignments.", Users, "Open the existing team workspace to manage authorized users."],
  ["Automation and n8n", "Workflow health, integration state, and ingestion controls.", Zap, "Secrets remain server-side; external channels require configuration."],
  ["Notifications", "Operational alerts and notification preferences.", Bell, "Uses the existing notifications and preference tables."],
  ["Security", "Authentication, quick access, audit history, and access gates.", LockKeyhole, "Protected by Supabase Auth, RLS, and server-side permission checks."],
  ["Data and backup", "Source-of-truth health, exports, and data operations.", Database, "Supabase remains the primary database; no browser-side secrets are exposed."],
  ["Appearance", "Centre and portal presentation settings.", Settings2, "Uses the existing Dantown portal design system."]
] as const;

export default async function SettingsPage() {
  const context = await requireAuthorizedPermission("users.read");
  return <PortalShell title="Settings." description="Business controls organized around the systems already running Dantown." roles={context.roles} permissions={context.permissions} links={[{ label: "Overview", href: "/admin" }, { label: "Settings", href: "/admin/settings" }, { label: "Team", href: "/admin/team", permission: "users.read" }, { label: "Automation", href: "/admin/automation", permission: "automation.read" }, { label: "POS", href: "/pos", permission: "orders.read" }]}>
    <div className="settings-grid">{settings.map(([title, description, Icon, status]) => <article className="settings-card" key={title}><span className="settings-icon"><Icon size={20} /></span><h2>{title}</h2><p>{description}</p><small>{status}</small>{title === "Users and permissions" ? <Link href="/admin/team">Open workspace</Link> : title === "Automation and n8n" ? <Link href="/admin/automation">Open workspace</Link> : null}</article>)}</div><NotificationPreferences />
  </PortalShell>;
}
