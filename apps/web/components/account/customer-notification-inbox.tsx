"use client";

import Link from "next/link";
import { useState } from "react";
import type { CustomerNotificationType } from "@dantown/database";

export type CustomerNotificationItem = {
  id: string;
  type: CustomerNotificationType;
  title: string;
  body: string;
  href: string;
  related_type: string | null;
  related_id: string | null;
  read_at: string | null;
  created_at: string;
};

const categories: Array<{ value: CustomerNotificationType | "all"; label: string }> = [
  { value: "all", label: "All updates" },
  { value: "order", label: "Orders" },
  { value: "payment", label: "Payments" },
  { value: "delivery", label: "Delivery" },
  { value: "quotation", label: "Quotes" },
  { value: "inquiry", label: "Support" },
  { value: "promotion", label: "Offers" },
  { value: "product", label: "New products" },
  { value: "back_in_stock", label: "Stock alerts" },
  { value: "account", label: "Account" },
];

export function CustomerNotificationInbox({
  initialNotifications,
  initialUnreadCount,
  inboxEnabled,
}: {
  initialNotifications: CustomerNotificationItem[];
  initialUnreadCount: number;
  inboxEnabled: boolean;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [category, setCategory] = useState<CustomerNotificationType | "all">("all");
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(initialNotifications.length);
  const [hasMore, setHasMore] = useState(initialNotifications.length === 30);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = notifications.filter((notification) => {
    if (category !== "all" && notification.type !== category) return false;
    if (readFilter === "unread" && notification.read_at) return false;
    if (readFilter === "read" && !notification.read_at) return false;
    if (search && !`${notification.title} ${notification.body}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function updateRead(id?: string) {
    setError("");
    setBusyId(id ?? "all");
    try {
      const response = await fetch("/api/account/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(id ? { id } : { all: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update notifications.");
      const now = new Date().toISOString();
      setNotifications((current) => current.map((notification) =>
        (!id || notification.id === id) && !notification.read_at
          ? { ...notification, read_at: now }
          : notification
      ));
      setUnreadCount((count) => id ? Math.max(count - 1, 0) : 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update notifications.");
    } finally {
      setBusyId(null);
    }
  }

  async function loadMore() {
    setBusyId("more");
    setError("");
    try {
      const params = new URLSearchParams({ limit: "30", offset: String(offset) });
      const response = await fetch(`/api/account/customer-notifications?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load more notifications.");
      const next = result.notifications as CustomerNotificationItem[];
      setNotifications((current) => [...current, ...next]);
      setOffset((current) => current + next.length);
      setHasMore(next.length === 30);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load more notifications.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="customer-notification-inbox" aria-labelledby="customer-notifications-heading">
      <div className="customer-notification-controls">
        <label>
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as CustomerNotificationType | "all")}>
            {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label>
          <span>Read status</span>
          <select value={readFilter} onChange={(event) => setReadFilter(event.target.value as typeof readFilter)}>
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </label>
        <label className="customer-notification-search">
          <span>Search updates</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your updates" />
        </label>
      </div>

      {unreadCount > 0 ? (
        <div className="customer-notification-actions">
          <span>{unreadCount} unread update{unreadCount === 1 ? "" : "s"}</span>
          <button type="button" disabled={busyId !== null} onClick={() => void updateRead()}>
            {busyId === "all" ? "Updating…" : "Mark all as read"}
          </button>
        </div>
      ) : null}

      {error ? <p className="customer-notification-error" role="alert">{error}</p> : null}

      {!inboxEnabled ? (
        <div className="customer-notification-empty">
          <h2>Your in-dashboard inbox is turned off.</h2>
          <p>You can still receive notifications through any separately enabled delivery channel.</p>
        </div>
      ) : filtered.length ? (
        <div className="customer-notification-list">
          {filtered.map((notification) => (
            <article
              className={`customer-notification-item${notification.read_at ? " is-read" : " is-unread"}`}
              key={notification.id}
            >
              <div className="customer-notification-content">
                <div className="customer-notification-meta">
                  <span>{categories.find((item) => item.value === notification.type)?.label ?? "Update"}</span>
                  <time dateTime={notification.created_at}>
                    {new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.created_at))}
                  </time>
                </div>
                <h2>{notification.title}</h2>
                <p>{notification.body}</p>
                <div className="customer-notification-item-actions">
                  <Link href={notification.href} onClick={() => {
                    if (!notification.read_at) void updateRead(notification.id);
                  }}>
                    View update
                  </Link>
                  {!notification.read_at ? (
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void updateRead(notification.id)}
                    >
                      Mark as read
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="customer-notification-empty">
          <h2>{notifications.length ? "No updates match these filters." : "Your inbox is clear."}</h2>
          <p>{notifications.length ? "Try another category or search term." : "Order, quote, support, and opted-in product updates will appear here."}</p>
        </div>
      )}
      {hasMore ? (
        <button className="customer-notification-load-more" type="button" disabled={busyId !== null} onClick={() => void loadMore()}>
          {busyId === "more" ? "Loading…" : "Load more updates"}
        </button>
      ) : null}
    </section>
  );
}
