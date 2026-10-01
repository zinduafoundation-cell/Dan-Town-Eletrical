import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { StorefrontShell } from "@/components/storefront";
import { NotificationPreferences } from "@/components/admin/notification-preferences";
import { requireAuthenticated } from "../../../lib/auth/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAuthenticated();
  return (
    <StorefrontShell>
      <main className="page-shell account-subpage">
        <Link className="back-link" href="/account"><ArrowLeft size={17} /> Back to My Dantown Hub</Link>
        <section className="account-subpage-card account-data-card">
          <span className="account-subpage-icon"><Settings size={26} /></span>
          <p className="eyebrow">My Dantown Hub</p>
          <h1>Account preferences</h1>
          <p>Choose how operational updates reach you.</p>
        </section>
        <NotificationPreferences />
      </main>
    </StorefrontShell>
  );
}
