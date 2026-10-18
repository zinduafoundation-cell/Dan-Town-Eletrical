"use client";

import { useEffect, useState } from "react";
import { BusinessReceipt, type BusinessReceiptLine } from "@/components/documents/business-receipt";
import { defaultBusinessDocumentSettings, formatBusinessDocumentDate, type BusinessDocumentSettings } from "@/lib/documents/business-document-settings";
import { showPOSReceiptEffect } from "@/lib/pos/receipt-effect";
import { APP_CURRENCY } from "@dantown/shared";

type ReceiptData = {
  orderNumber: string;
  date: string;
  customer: string | null;
  paymentMethod: string | null;
  lines: BusinessReceiptLine[];
  subtotal: number;
  discount: number;
  tax: number;
  delivery: number;
  total: number;
};

export function CustomerOrderReceipt({
  orderId,
  enabled = true,
  triggerEffectOnLoad = false
}: {
  orderId: string;
  enabled?: boolean;
  triggerEffectOnLoad?: boolean;
}) {
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [settings, setSettings] = useState<BusinessDocumentSettings>(defaultBusinessDocumentSettings);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void (async () => {
      try {
        const match = window.location.hash.match(/(?:^#|&)paymentToken=([^&]+)/);
        const paymentToken = match ? decodeURIComponent(match[1]) : undefined;
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/receipt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(paymentToken ? { paymentToken } : {}),
        });
        const result = await response.json();
        if (!response.ok) {
          if (active) setMessage(result.error ?? "The receipt could not be loaded.");
          return;
        }
        if (active) {
          const confirmedReceipt = result.receipt as ReceiptData;
          setReceipt(confirmedReceipt);
          setSettings(result.settings as BusinessDocumentSettings);
          if (triggerEffectOnLoad && confirmedReceipt.lines.length > 0 && confirmedReceipt.paymentMethod) {
            showPOSReceiptEffect({
              receiptNumber: confirmedReceipt.orderNumber,
              currency: APP_CURRENCY,
              items: confirmedReceipt.lines.map((line) => ({
                name: line.name,
                sku: line.sku,
                qty: line.quantity,
                total: line.total
              })),
              subtotal: confirmedReceipt.subtotal,
              discount: confirmedReceipt.discount,
              tax: confirmedReceipt.tax,
              delivery: confirmedReceipt.delivery,
              total: confirmedReceipt.total,
              paymentMethod: confirmedReceipt.paymentMethod,
              date: confirmedReceipt.date
            });
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.delete("paymentVerified");
            currentUrl.hash = "";
            window.history.replaceState(window.history.state, "", `${currentUrl.pathname}${currentUrl.search}`);
          }
        }
      } catch (error) {
        console.error("Unable to load customer receipt.", error);
        if (active) setMessage("Could not load the receipt. Please try again.");
      }
    })();
    return () => { active = false; };
  }, [enabled, orderId, triggerEffectOnLoad]);

  if (!enabled) return null;
  return (
    <section className="customer-receipt-panel">
      <h2>Payment receipt</h2>
      {receipt ? (
        <>
          <BusinessReceipt
            settings={settings}
            reference={receipt.orderNumber}
            date={formatBusinessDocumentDate(receipt.date, settings)}
            customer={receipt.customer}
            paymentMethod={receipt.paymentMethod}
            lines={receipt.lines}
            subtotal={receipt.subtotal}
            discount={receipt.discount}
            tax={receipt.tax}
            delivery={receipt.delivery}
            total={receipt.total}
          />
          <button className="button button-primary" type="button" onClick={() => window.print()}>Print or save receipt</button>
        </>
      ) : <p role="status">{message || "Loading your receipt…"}</p>}
    </section>
  );
}
