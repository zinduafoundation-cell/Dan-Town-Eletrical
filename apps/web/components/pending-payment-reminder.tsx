"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { clearPendingPaymentReminder, readPendingPaymentReminder } from "@/lib/pending-payment";

export function PendingPaymentReminder() {
  const [pending, setPending] = useState<ReturnType<typeof readPendingPaymentReminder>>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const reminder = readPendingPaymentReminder();
      setPending(reminder);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!pending) return null;

  return (
    <aside
      aria-label="Pending payment reminder"
      style={{
        position: "fixed",
        right: "1rem",
        bottom: "1rem",
        zIndex: 50,
        maxWidth: "min(28rem, calc(100vw - 2rem))",
        padding: "1rem",
        borderRadius: "1rem",
        background: "#071526",
        color: "#fff",
        boxShadow: "0 16px 40px rgba(7, 21, 38, .25)"
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
