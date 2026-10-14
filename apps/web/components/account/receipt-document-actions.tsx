"use client";

import { useState } from "react";
import { Download, Eye, Printer } from "lucide-react";
import { showPOSReceiptEffect, type ReceiptEffectSale } from "@/lib/pos/receipt-effect";
import { createReceiptPdf } from "@/lib/pos/receipt-pdf";

type ReceiptDocument = ReceiptEffectSale & { orderId: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}

export function ReceiptDocumentActions({ document }: { document: ReceiptDocument }) {
  const [error, setError] = useState<string | null>(null);

  function replay() {
    setError(null);
    showPOSReceiptEffect(document);
  }

  function download() {
    setError(null);
    const url = URL.createObjectURL(createReceiptPdf(document));
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `receipt-${document.receiptNumber}.pdf`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function print() {
    setError(null);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("Allow pop-ups to print this receipt.");
      return;
    }
    const itemRows = document.items.map((item) =>
      `<tr><td>${item.qty} x ${escapeHtml(item.name)}${item.sku ? `<small>${escapeHtml(item.sku)}</small>` : ""}</td><td>${document.currency} ${item.total.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</td></tr>`
    ).join("");
    const totals = [
      ["Subtotal", document.subtotal],
      ["Discount", document.discount],
      ["Tax", document.tax],
      ["Delivery", document.delivery],
      ["Total", document.total]
    ].map(([label, value]) => `<div><span>${label}</span><strong>${document.currency} ${Number(value).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</strong></div>`).join("");
    printWindow.document.write(`<!doctype html><html><head><title>Receipt ${escapeHtml(document.receiptNumber)}</title><style>body{font:14px Arial,sans-serif;color:#071a33;margin:36px auto;max-width:640px;padding:20px}h1{font-size:22px}p{color:#475a73}table{border-collapse:collapse;width:100%;margin:24px 0}td{border-bottom:1px solid #ddd;padding:10px 0}td:last-child{text-align:right}small{display:block;color:#68778a}section div{display:flex;justify-content:space-between;padding:6px 0}section div:last-child{border-top:2px solid #071a33;font-size:17px;margin-top:8px;padding-top:12px}@media print{body{margin:0}}</style></head><body><h1>Dantown Electrical</h1><p>Receipt ${escapeHtml(document.receiptNumber)}<br>${escapeHtml(new Date(document.date).toLocaleString("en-KE"))}<br>Payment: ${escapeHtml(document.paymentMethod)}</p><table><tbody>${itemRows}</tbody></table><section>${totals}</section><script>window.addEventListener("load",()=>window.print())</script></body></html>`);
    printWindow.document.close();
  }

  return (
    <div className="receipt-document-actions">
      <button className="button button-quiet" type="button" onClick={replay}><Eye size={15} /> View</button>
      <button className="button button-quiet" type="button" onClick={print}><Printer size={15} /> Print</button>
      <button className="button button-quiet" type="button" onClick={download}><Download size={15} /> Download PDF</button>
      {error && <p className="receipt-action-error" role="alert">{error}</p>}
    </div>
  );
}
