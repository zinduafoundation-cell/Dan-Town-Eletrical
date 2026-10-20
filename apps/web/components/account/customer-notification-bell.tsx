"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function CustomerNotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/account/customer-notifications?limit=1", {
          cache: "no-store",
        });
        if (response.status === 401) {
          if (active) setSignedIn(false);
          return;
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load notifications.");
        if (active) {
          setSignedIn(true);
          setUnreadCount(Number(result.unreadCount) || 0);
        }
      } catch (error) {
        console.error("Customer notification badge could not refresh.", error);
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, 120_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (!signedIn) return null;
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
