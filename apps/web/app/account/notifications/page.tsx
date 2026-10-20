import { requireAuthenticated } from "../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { StorefrontShell } from "@/components/storefront";
import { CustomerNotificationInbox } from "@/components/account/customer-notification-inbox";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AccountNotificationsPage() {
  const context = await requireAuthenticated();
  let notifications: Array<{
    id: string;
    type: "order" | "payment" | "delivery" | "promotion" | "product" | "back_in_stock" | "inquiry" | "quotation" | "account";
    title: string;
    body: string;
    href: string;
    related_type: string | null;
    related_id: string | null;
    read_at: string | null;
    created_at: string;
  }> = [];
  let unreadCount = 0;
  let inboxEnabled = true;
  if (context.userId !== "dev-bypass-user") {
    const supabase = await createSupabaseServerClient();
    const { data: preferences, error: preferencesError } = await supabase
      .from("customer_notification_preferences")
      .select("inbox_enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (preferencesError) throw new Error(`Unable to load your notification preferences: ${preferencesError.message}`);
    inboxEnabled = preferences?.inbox_enabled ?? true;
    if (inboxEnabled) {
      const [{ data, error }, { count, error: countError }] = await Promise.all([
        supabase
          .from("customer_notifications")
          .select("id,type,title,body,href,related_type,related_id,read_at,created_at")
          .eq("user_id", context.userId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(30),
        supabase
          .from("customer_notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", context.userId)
          .is("read_at", null),
      ]);
      if (error) throw new Error(`Unable to load your notifications: ${error.message}`);
      if (countError) throw new Error(`Unable to count your unread notifications: ${countError.message}`);
      notifications = data ?? [];
      unreadCount = count ?? 0;
    }
  }

  return (
    <StorefrontShell>
      <main className="page-shell account-subpage">
        <section className="account-subpage-card account-data-card">
          <p className="eyebrow">My Dantown Hub</p>
          <h1 id="customer-notifications-heading">Your notifications</h1>
          <p>{!inboxEnabled ? "Your in-dashboard inbox is turned off." : unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You are all caught up."} Updates are private to your signed-in customer account.</p>
        </section>
        <CustomerNotificationInbox
          initialNotifications={notifications ?? []}
          initialUnreadCount={unreadCount ?? 0}
          inboxEnabled={inboxEnabled}
        />
        <p className="customer-notification-settings-link"><Link href="/account/settings">Manage notification preferences</Link></p>
      </main>
    </StorefrontShell>
  );
}
