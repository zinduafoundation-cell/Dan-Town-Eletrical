"use client";

import { useEffect, useRef, useState } from "react";
import { BusinessReceipt, type BusinessReceiptLine } from "@/components/documents/business-receipt";
import { defaultBusinessDocumentSettings, formatBusinessDocumentDate, type BusinessDocumentSettings } from "@/lib/documents/business-document-settings";
import { showPOSReceiptEffect } from "@/lib/pos/receipt-effect";
import { APP_CURRENCY } from "@dantown/shared";

type ReceiptData = {
  receiptNumber: string;
  paymentId: string;
  paymentAmount: number;
  orderNumber: string;
  date: string;
  customer: string | null;
  customerContact: string | null;
  taxPin: string | null;
  paymentMethod: string | null;
  payments: Array<{ id: string; method: string; amount: number; currency: string; date: string }>;
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
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [settings, setSettings] = useState<BusinessDocumentSettings>(defaultBusinessDocumentSettings);
  const [message, setMessage] = useState("");
  const accessToken = useRef<{ orderId: string; token?: string }>({ orderId, token: undefined });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void (async () => {
      try {
        if (accessToken.current.orderId !== orderId) {
          accessToken.current = { orderId, token: undefined };
        }
        if (!accessToken.current.token) {
          const match = window.location.hash.match(/(?:^#|&)paymentToken=([^&]+)/);
          if (match) accessToken.current.token = decodeURIComponent(match[1]);
        }
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/receipt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(accessToken.current.token ? { paymentToken: accessToken.current.token } : {}),
            ...(selectedPaymentId ? { paymentId: selectedPaymentId } : {}),
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          if (active) setMessage(result.error ?? "The receipt could not be loaded.");
          return;
        }
        if (active) {
          const confirmedReceipt = result.receipt as ReceiptData;
          setReceipt(confirmedReceipt);
          if (!selectedPaymentId) setSelectedPaymentId(confirmedReceipt.paymentId);
          setSettings(result.settings as BusinessDocumentSettings);
          if (triggerEffectOnLoad && !selectedPaymentId && confirmedReceipt.lines.length > 0 && confirmedReceipt.paymentMethod) {
            showPOSReceiptEffect({
              receiptNumber: confirmedReceipt.receiptNumber,
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
  }, [enabled, orderId, selectedPaymentId, triggerEffectOnLoad]);

  if (!enabled) return null;
  return (
    <section className="customer-receipt-panel">
      <h2>Payment receipt</h2>
      {receipt ? (
        <>
          {receipt.payments.length > 1 && <label className="customer-receipt-payment-select">
            Receipt for payment
            <select value={receipt.paymentId} onChange={(event) => {
              setSelectedPaymentId(event.target.value);
              setReceipt(null);
              setMessage("Loading the selected verified payment receipt…");
            }}>
              {receipt.payments.map((payment) => <option key={payment.id} value={payment.id}>
                {payment.currency} {payment.amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {payment.method} · {formatBusinessDocumentDate(payment.date, settings)}
              </option>)}
            </select>
          </label>}
          <BusinessReceipt
            settings={settings}
            reference={receipt.receiptNumber}
            date={formatBusinessDocumentDate(receipt.date, settings)}
            customer={receipt.customer}
            customerContact={receipt.customerContact}
            paymentMethod={receipt.paymentMethod}
            taxPin={receipt.taxPin}
            relatedReference={receipt.orderNumber}
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
