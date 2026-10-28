"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createCustomerNotificationPoller } from "@/lib/customer-notification-polling";
import { useAuthSession } from "@/components/auth-session-provider";

export function CustomerNotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unauthorizedUserId, setUnauthorizedUserId] = useState<string | null>(null);
  const { status: sessionStatus, userId } = useAuthSession();

  useEffect(() => {
    if (sessionStatus !== "ready" || !userId) return;
    let active = true;
    const poller = createCustomerNotificationPoller({
      request: async () => {
        const response = await fetch("/api/account/customer-notifications?limit=1", {
          cache: "no-store",
        });
        return response;
      },
      onUnreadCount: (count) => {
        if (active) setUnreadCount(count);
      },
      onUnauthorized: () => {
        if (active) setUnauthorizedUserId(userId);
      },
      onError: (error) => console.error("Customer notification badge could not refresh.", error),
    });

    const refreshOnFocus = () => poller.refreshNow();
    poller.start();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      active = false;
      poller.stop();
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [sessionStatus, userId]);

  if (sessionStatus !== "ready" || !userId || unauthorizedUserId === userId) return null;
  return (
    <Link
      className="customer-notification-bell"
      href="/account/notifications"
      aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
      title="Notifications"
    >
      <Bell size={18} aria-hidden="true" />
      {unreadCount > 0 ? (
        <span aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>
      ) : null}
    </Link>
  );
}
