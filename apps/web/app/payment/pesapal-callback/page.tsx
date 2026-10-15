"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";
import { APP_CURRENCY } from "@dantown/shared";
import { showPOSReceiptEffect } from "@/lib/pos/receipt-effect";

const verifyResponseSchema = z.object({
  success: z.literal(true),
  orderId: z.string(),
  orderNumber: z.string(),
  salesChannel: z.enum(["ONLINE", "POS"]),
  receipt: z.object({
    subtotal: z.number(),
    discount: z.number(),
    tax: z.number(),
    delivery: z.number(),
    total: z.number(),
    paymentMethod: z.string(),
    date: z.string(),
    items: z.array(z.object({
      name: z.string(),
      sku: z.string(),
      qty: z.number(),
      total: z.number(),
    })),
  }),
});

export default function PesapalCallbackPage() {
  const params = useSearchParams();
  const router = useRouter();
  const orderId = params.get("orderId") ?? "";
  const channel = params.get("channel") ?? "";
  const trackingId = params.get("OrderTrackingId") ?? params.get("orderTrackingId") ?? "";
  const merchantReference = params.get("OrderMerchantReference") ?? params.get("orderMerchantReference") ?? "";
  const [message, setMessage] = useState("Checking your payment with Pesapal…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      if (!orderId || !trackingId || !merchantReference) {
        setFailed(true);
        setMessage("The payment return is missing its transaction details. Contact Dantown support before retrying.");
        return;
      }

      const paymentToken = window.sessionStorage.getItem(`dantown-payment-token:${orderId}`) ?? "";
      try {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          if (attempt > 0) await new Promise((resolve) => window.setTimeout(resolve, 5_000));
          const response = await fetch("/api/checkout/pesapal-verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId,
              trackingId,
              merchantReference,
              ...(paymentToken ? { paymentToken } : {}),
            }),
          });
          const result: unknown = await response.json();
          if (response.status === 202) continue;
          const verifiedResult = verifyResponseSchema.safeParse(result);
          if (!response.ok || !verifiedResult.success) {
            const errorMessage = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
              ? result.error
              : "Pesapal could not confirm this payment.";
            throw new Error(errorMessage);
          }
          const verified = verifiedResult.data;
          if (cancelled) return;
          window.sessionStorage.removeItem(`dantown-payment-token:${orderId}`);
          if (verified.salesChannel === "POS") {
            showPOSReceiptEffect({
              receiptNumber: verified.orderNumber,
              currency: APP_CURRENCY,
              items: verified.receipt.items,
              subtotal: verified.receipt.subtotal,
              discount: verified.receipt.discount,
              tax: verified.receipt.tax,
              delivery: verified.receipt.delivery,
              total: verified.receipt.total,
              paymentMethod: verified.receipt.paymentMethod,
              date: verified.receipt.date,
            });
            router.replace("/pos/new-sale");
          } else {
            router.replace(`/order-confirmation?orderId=${encodeURIComponent(verified.orderId)}&paymentVerified=1#paymentToken=${encodeURIComponent(paymentToken)}`);
          }
          return;
        }
        throw new Error("Pesapal has not confirmed the payment yet. Check the order status again in a few minutes.");
      } catch (error) {
        if (!cancelled) {
          setFailed(true);
          setMessage(error instanceof Error ? error.message : "Unable to verify this payment.");
        }
      }
    };
    void verify();
    return () => { cancelled = true; };
  }, [merchantReference, orderId, router, trackingId]);

  return (
    <main className="page-shell payment-page">
      <section className="payment-empty" aria-live="polite">
        {failed ? <AlertCircle size={42} /> : message.startsWith("Payment confirmed") ? <CheckCircle2 size={42} /> : <Loader2 className="animate-spin" size={36} />}
        <h1>{failed ? "Payment confirmation pending" : "Verifying payment"}</h1>
        <p>{message}</p>
        {failed && (
          <div className="payment-action">
            <Link href={channel === "POS" ? "/pos/new-sale" : orderId ? `/order-confirmation?orderId=${encodeURIComponent(orderId)}` : "/"} className="button button-primary">
              {channel === "POS" ? "Return to POS" : "Check order status"}
            </Link>
            <Link href="/contact" className="button button-secondary">Contact support</Link>
          </div>
        )}
      </section>
    </main>
  );
}
