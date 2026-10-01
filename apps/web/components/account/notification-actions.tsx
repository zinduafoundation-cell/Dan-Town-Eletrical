"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NotificationActions({ unreadIds }: { unreadIds: string[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  async function markRead(id?: string) {
    setSaving(true);
    const response = await fetch("/api/account/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true })
    });
    setSaving(false);
    if (response.ok) router.refresh();
  }
  if (!unreadIds.length) return null;
  return <button className="button button-secondary notification-mark-read" type="button" disabled={saving} onClick={() => markRead()}>{saving ? "Updating..." : "Mark all as read"}</button>;
}
