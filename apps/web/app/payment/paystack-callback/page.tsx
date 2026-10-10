"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function OnlinePaystackCallbackPage() {
  const params = useSearchParams();
  const reference = params.get("reference");
  const orderId = params.get("orderId");
  const [message, setMessage] = useState(() =>
    reference
      ? "Verifying Paystack payment..."
      : "Payment confirmation details are missing. Check the order status before trying again."
  );

  useEffect(() => {
    if (!reference) return;

    let active = true;
    fetch("/api/checkout/paystack-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference })
    })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (
          !response.ok ||
          typeof result !== "object" ||
          result === null ||
          !("success" in result) ||
          result.success !== true ||
          !("orderNumber" in result) ||
          typeof result.orderNumber !== "string" ||
          !("orderId" in result) ||
          typeof result.orderId !== "string"
        ) {
          const error =
            typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
              ? result.error
              : "Payment could not be verified.";
          throw new Error(error);
        }

        if (active) {
          window.location.replace(`/order-confirmation?orderId=${encodeURIComponent(result.orderId)}`);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Payment could not be verified.");
        }
      });

    return () => {
      active = false;
    };
  }, [reference]);

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Paystack sandbox</p>
        <h1>{message}</h1>
        <p>
          This test flow will not take real payment. If verification fails, your order remains unpaid.
        </p>
        {orderId && (
          <Link
            className="button button-primary"
            href={`/order-confirmation?orderId=${encodeURIComponent(orderId)}`}
          >
            View order status
          </Link>
        )}
      </section>
    </main>
  );
}
