import { Bell, CheckCircle2 } from "lucide-react";
import { requireAuthenticated } from "../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { PortalShell } from "../../portal-shell";

export const dynamic = "force-dynamic";

export default async function AccountNotificationsPage() {
  const context = await requireAuthenticated();
  const supabase = await createSupabaseServerClient();
  const { data: notificationsData } = await supabase
    .from("notifications")
    .select("id,type,title,body,read_at,created_at")
    .eq("user_id", context.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const notifications = notificationsData ?? []; const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <PortalShell
      title="Your notifications."
      description="Stay up to date with order, payment, quotation, and account activity."
      roles={context.roles}
      permissions={context.permissions}
      links={[
        { label: "Overview", href: "/account" },
        { label: "Orders", href: "/account/orders" },
        { label: "Quotes", href: "/account/quotes" },
        { label: "Notifications", href: "/account/notifications" },
        { label: "Wishlist", href: "/account/wishlist" },
      ]}
    >
      <section className="account-notifications-panel">
        <div className="account-notifications-heading">
          <div>
            <p className="eyebrow">Account updates</p>
            <h2>{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You are all caught up."}</h2>
          </div>
          <Bell size={25} />
        </div>

        {notifications.length ? (
          <div className="account-notification-list">
            {notifications.map((notification) => (
              <article className={`account-notification${notification.read_at ? " is-read" : ""}`} key={notification.id}>
                <span className="account-notification-icon">
                  {notification.read_at ? <CheckCircle2 size={17} /> : <Bell size={17} />}
                </span>
                <div>
                  <div className="account-notification-meta">
                    <small>{notification.type}</small>
                    <time dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString()}</time>
                  </div>
                  <h3>{notification.title}</h3>
                  <p>{notification.body}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No notifications yet.</h3>
            <p>Important updates about your Dantown activity will appear here.</p>
          </div>
        )}
      </section>
    </PortalShell>
  );
}

