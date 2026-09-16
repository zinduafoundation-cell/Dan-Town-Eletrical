"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function PaystackCallbackPage() {
  const params = useSearchParams();
  const reference = params.get("reference");
  const orderId = params.get("orderId");
  const hasPaymentDetails = Boolean(reference && orderId);
  const [message, setMessage] = useState("Confirming payment...");

  useEffect(() => {
    if (!reference || !orderId) return;
    fetch("/api/pos/paystack-verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference, orderId }) })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Payment could not be confirmed.");
        setMessage(`Payment confirmed for ${result.orderNumber}.`);
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Payment could not be confirmed."));
  }, [orderId, reference]);

  return <main className="auth-page"><section className="auth-panel"><p className="eyebrow">Paystack payment</p><h1>{hasPaymentDetails ? message : "Payment confirmation details are missing."}</h1><Link className="button button-primary" href="/pos/new-sale">Return to POS</Link></section></main>;
}