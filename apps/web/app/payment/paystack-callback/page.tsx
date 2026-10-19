"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

export default function PaystackCallbackPage() {
  const params = useSearchParams();
  const router = useRouter();
  const orderId = params.get("orderId") ?? "";
  const reference = params.get("reference") ?? "";
  const [message, setMessage] = useState("Checking your payment with Paystack…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      if (!orderId || !reference) {
        setFailed(true);
        setMessage("The payment return is missing its transaction details. Contact Dantown support before retrying.");
        return;
      }

      const paymentToken = window.sessionStorage.getItem(`dantown-payment-token:${orderId}`) ?? "";
      if (!paymentToken) {
        setFailed(true);
        setMessage("The secure payment session has expired. Check your order status or contact Dantown support.");
        return;
      }

      try {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          if (attempt > 0) await new Promise((resolve) => window.setTimeout(resolve, 5_000));
          const response = await fetch("/api/checkout/paystack-verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, reference, paymentToken }),
          });
          const result: unknown = await response.json();
          if (response.status === 202) continue;
          if (
            !response.ok ||
            typeof result !== "object" ||
            result === null ||
            !("success" in result) ||
            result.success !== true ||
            !("orderId" in result) ||
            result.orderId !== orderId
          ) {
            const errorMessage = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
              ? result.error
              : "Paystack could not confirm this payment.";
            throw new Error(errorMessage);
          }
          if (cancelled) return;
          window.sessionStorage.removeItem(`dantown-payment-token:${orderId}`);
          router.replace(`/order-confirmation?orderId=${encodeURIComponent(orderId)}&paymentVerified=1#paymentToken=${encodeURIComponent(paymentToken)}`);
          return;
        }
        throw new Error("Paystack has not confirmed the payment yet. Check the order status again in a few minutes.");
      } catch (error) {
        if (!cancelled) {
          setFailed(true);
          setMessage(error instanceof Error ? error.message : "Unable to verify this payment.");
        }
      }
    };
    void verify();
    return () => { cancelled = true; };
  }, [orderId, reference, router]);

  return (
    <main className="page-shell payment-page">
      <section className="payment-empty" aria-live="polite">
        {failed ? <AlertCircle size={42} /> : <Loader2 className="animate-spin" size={36} />}
        <h1>{failed ? "Payment confirmation pending" : "Verifying payment"}</h1>
        <p>{message}</p>
        {failed && (
          <div className="payment-action">
            <Link href={orderId ? `/order-confirmation?orderId=${encodeURIComponent(orderId)}` : "/"} className="button button-primary">
              Check order status
            </Link>
            <Link href="/contact" className="button button-secondary">Contact support</Link>
          </div>
        )}
      </section>
    </main>
  );
}
