"use client";

import { useEffect, useState } from "react";
import { BusinessReceipt, type BusinessReceiptLine } from "@/components/documents/business-receipt";
import { defaultBusinessDocumentSettings, type BusinessDocumentSettings } from "@/lib/documents/business-document-settings";

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

export function CustomerOrderReceipt({ orderId, enabled = true }: { orderId: string; enabled?: boolean }) {
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
          setReceipt(result.receipt as ReceiptData);
          setSettings(result.settings as BusinessDocumentSettings);
        }
      } catch (error) {
        console.error("Unable to load customer receipt.", error);
        if (active) setMessage("Could not load the receipt. Please try again.");
      }
    })();
    return () => { active = false; };
  }, [enabled, orderId]);

  if (!enabled) return null;
  return (
    <section className="customer-receipt-panel">
      <h2>Payment receipt</h2>
      {receipt ? (
        <>
          <BusinessReceipt
            settings={settings}
            reference={receipt.orderNumber}
            date={new Date(receipt.date).toLocaleString("en-KE")}
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
