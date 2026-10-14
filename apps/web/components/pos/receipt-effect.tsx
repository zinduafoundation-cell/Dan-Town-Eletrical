"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { subscribePOSReceiptEffect, type ReceiptEffectSale } from "@/lib/pos/receipt-effect";

type ActiveReceipt = ReceiptEffectSale & { key: number };

function barcodeBits(value: string) {
  return `101${Array.from(value).map((character) => character.charCodeAt(0).toString(2).padStart(8, "0")).join("0")}101`;
}

export function ReceiptEffect() {
  const [receipt, setReceipt] = useState<ActiveReceipt | null>(null);
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);
  const animationFrame = useRef<number | null>(null);
  const sequence = useRef(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const clearScheduledWork = () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
      if (animationFrame.current !== null) {
        window.cancelAnimationFrame(animationFrame.current);
        animationFrame.current = null;
      }
    };

    const onSaleComplete = (sale: ReceiptEffectSale) => {
      if (
        !sale?.receiptNumber ||
        !sale.currency ||
        !sale.paymentMethod ||
        !sale.date ||
        !Array.isArray(sale.items) ||
        sale.items.length === 0 ||
        ![sale.subtotal, sale.discount, sale.tax, sale.delivery, sale.total].every(Number.isFinite)
      ) return;
      clearScheduledWork();
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setVisible(false);
      setReceipt({ ...sale, key: ++sequence.current });
      animationFrame.current = window.requestAnimationFrame(() => {
        setVisible(true);
        closeButton.current?.focus();
        animationFrame.current = null;
      });

      timers.current.push(window.setTimeout(() => {
        setVisible(false);
        setReceipt(null);
        previousFocus.current?.focus();
      }, 7500));
    };

    const unsubscribe = subscribePOSReceiptEffect(onSaleComplete);
    return () => {
      clearScheduledWork();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!receipt) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        timers.current.forEach((timer) => window.clearTimeout(timer));
        timers.current = [];
        setVisible(false);
        setReceipt(null);
        previousFocus.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [receipt]);

  if (!receipt) return null;

  const itemCount = receipt.items.reduce((sum, item) => sum + item.qty, 0);
  const formatMoney = (amount: number) => amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const barcode = barcodeBits(receipt.receiptNumber);
  const dismiss = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setVisible(false);
    setReceipt(null);
    previousFocus.current?.focus();
  };

  return (
    <div className={`receipt-effect-stage${visible ? " show" : ""}`} key={receipt.key}>
      <section className="receipt-effect-panel" aria-label={`Receipt ${receipt.receiptNumber}`}>
        <div className="receipt-effect-toast" role="status" aria-live="polite" aria-atomic="true">
          <div className="receipt-effect-toast-heading">
            <span className="receipt-effect-brand-mark" aria-hidden="true">D</span>
            <span><b>Sale complete</b><span className="receipt-effect-meta">Order {receipt.receiptNumber} · {itemCount} items</span></span>
            <strong className="receipt-effect-amount">{receipt.currency} {formatMoney(receipt.total)}</strong>
            <button ref={closeButton} type="button" className="receipt-effect-close" onClick={dismiss} aria-label="Close receipt">
              <X size={17} />
            </button>
          </div>
          <div className="receipt-effect-printing"><span>Printing your receipt…</span><span className="receipt-effect-progress" /></div>
        </div>
        <article className="receipt-effect-paper" aria-label="Sale receipt">
          <header>
            <span className="receipt-effect-paper-mark" aria-hidden="true">D</span>
            <strong>Dantown Electrical</strong>
            <small>Receipt {receipt.receiptNumber}</small>
            <small>{new Date(receipt.date).toLocaleString("en-KE")}</small>
          </header>
          <div className="receipt-effect-items">
            {receipt.items.map((item, index) => (
              <div className="receipt-effect-item" key={`${item.name}-${index}`}>
                <span>{item.qty} × {item.name}</span>
                <strong>{receipt.currency} {formatMoney(item.total)}</strong>
              </div>
            ))}
          </div>
          <div className="receipt-effect-totals">
            <div><span>Subtotal</span><span>{receipt.currency} {formatMoney(receipt.subtotal)}</span></div>
            <div><span>Discount</span><span>{receipt.currency} {formatMoney(receipt.discount)}</span></div>
            <div><span>Tax</span><span>{receipt.currency} {formatMoney(receipt.tax)}</span></div>
            <div><span>Delivery</span><span>{receipt.currency} {formatMoney(receipt.delivery)}</span></div>
            <div className="receipt-effect-grand-total"><strong>Total</strong><strong>{receipt.currency} {formatMoney(receipt.total)}</strong></div>
          </div>
          <p className="receipt-effect-method">Payment: {receipt.paymentMethod}</p>
          <svg className="receipt-effect-barcode" viewBox={`0 0 ${barcode.length} 42`} role="img" aria-label={`Barcode for order ${receipt.receiptNumber}`}>
            {Array.from(barcode).map((bit, index) => bit === "1" ? <rect key={index} x={index} y="0" width="1" height="32" /> : null)}
            <text x="50%" y="40" textAnchor="middle">{receipt.receiptNumber}</text>
          </svg>
        </article>
      </section>
    </div>
  );
}
