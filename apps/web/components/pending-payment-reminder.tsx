"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import {
  clearPendingPaymentReminder,
  onPendingPaymentCleared,
  readPendingPaymentReminder,
  type PendingPaymentReminderData,
} from "@/lib/pending-payment";

const HIDDEN_PREFIXES = ["/pos", "/admin", "/business-center", "/staff", "/payment", "/login", "/register", "/logout"];

/**
 * "Finish your order" prompt. It only appears for the signed-in customer who
 * owns an order that is still waiting for payment. Signing out, switching
 * accounts, paying, cancelling or deleting the order removes it.
 */
export function PendingPaymentReminder() {
  const pathname = usePathname();
  const [pending, setPending] = useState<PendingPaymentReminderData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stored = readPendingPaymentReminder();
    if (!stored) return;

    (async () => {
      try {
        const response = await fetch(`/api/orders/pending-reminder?orderId=${encodeURIComponent(stored.orderId)}`, { cache: "no-store" });
        const result = response.ok ? ((await response.json()) as { pending: boolean; userId: string | null }) : { pending: false, userId: null };
        if (cancelled) return;
        // Guests never see reminders, and neither does anyone but the order's owner.
        if (!result.userId || !result.pending) {
          clearPendingPaymentReminder();
          setPending(null);
          return;
        }
        setPending(stored);
      } catch {
        if (!cancelled) setPending(null);
      }
    })();

    const stopListening = onPendingPaymentCleared(() => setPending(null));
    return () => {
      cancelled = true;
      stopListening();
    };
  }, [pathname]);

  if (!pending) return null;
  if (HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;

  return (
    <aside
      aria-label="Pending payment reminder"
      style={{
        position: "fixed",
        right: "1rem",
        bottom: "4.5rem",
        zIndex: 50,
        maxWidth: "min(28rem, calc(100vw - 2rem))",
        padding: "1rem",
        borderRadius: "1rem",
        background: "#071526",
        color: "#fff",
        boxShadow: "0 16px 40px rgba(7, 21, 38, .25)",
      }}
    >
      <button
        type="button"
        onClick={() => {
          clearPendingPaymentReminder();
          setPending(null);
        }}
        aria-label="Dismiss payment reminder"
        style={{ position: "absolute", top: ".5rem", right: ".5rem", color: "inherit" }}
      >
        <X size={16} />
      </button>
      <strong>Finish your order</strong>
      <p style={{ margin: ".35rem 0 .75rem", paddingRight: "1rem" }}>
        Order {pending.orderNumber} is waiting for payment.
      </p>
      <Link
        href={`/payment?orderId=${encodeURIComponent(pending.orderId)}&orderNumber=${encodeURIComponent(pending.orderNumber)}&total=${encodeURIComponent(pending.total)}`}
        className="button button-primary"
      >
        Continue to payment
      </Link>
    </aside>
  );
}
