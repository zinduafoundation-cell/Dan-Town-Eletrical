"use client";

import { useEffect, useRef, useState } from "react";
import { APP_LOCATION, APP_NAME } from "@dantown/shared";
import type { ReceiptEffectSale } from "@/lib/pos/receipt-effect";

type ActiveReceipt = ReceiptEffectSale & { createdAt: string; key: number };

export function ReceiptEffect() {
  const [receipt, setReceipt] = useState<ActiveReceipt | null>(null);
  const [visible, setVisible] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printed, setPrinted] = useState(false);
  const timers = useRef<number[]>([]);
  const animationFrame = useRef<number | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    const clearScheduledWork = () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
      if (animationFrame.current !== null) {
        window.cancelAnimationFrame(animationFrame.current);
        animationFrame.current = null;
      }
    };

    const onSaleComplete = (event: Event) => {
      const sale = (event as CustomEvent<ReceiptEffectSale>).detail;
      if (!sale?.receiptNumber || !sale.currency || !Array.isArray(sale.items) || sale.items.length === 0) return;
      clearScheduledWork();
      setVisible(false);
      setPrinting(false);
      setPrinted(false);
      setReceipt({ ...sale, createdAt: new Date().toLocaleString("en-KE"), key: ++sequence.current });
      animationFrame.current = window.requestAnimationFrame(() => {
        setVisible(true);
        animationFrame.current = null;
      });

      timers.current.push(window.setTimeout(() => setPrinting(true), 600));
      timers.current.push(window.setTimeout(() => setPrinted(true), 3100));
      timers.current.push(window.setTimeout(() => {
        setVisible(false);
        setPrinting(false);
        setReceipt(null);
      }, 6500));
    };

    window.addEventListener("dantown-pos-sale-completed", onSaleComplete);
    return () => {
      clearScheduledWork();
      window.removeEventListener("dantown-pos-sale-completed", onSaleComplete);
    };
  }, []);

  if (!receipt) return null;

  const total = receipt.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const formatMoney = (amount: number) => amount.toLocaleString("en-KE", { minimumFractionDigits: 2 });

  return (
    <div className="receipt-effect-stage" aria-live="polite" aria-atomic="true" key={receipt.key}>
      <div className={`receipt-effect-toast${visible ? " show" : ""}`}>
        <div className="receipt-effect-brand">{APP_NAME}</div>
        <div className="receipt-effect-line">
          <div><b>Sale complete</b><div className="receipt-effect-meta">{receipt.items.length} items · {receipt.receiptNumber}</div></div>
          <div className="receipt-effect-amount">{receipt.currency} {formatMoney(total)}</div>
        </div>
        <div className="receipt-effect-status">{printed ? "✓ Receipt printed" : "Printing the receipt…"}</div>
        <div className="receipt-effect-bar"><i className={printing ? "fill" : ""} /></div>
      </div>
      <div className="receipt-effect-slot">
        <div className={`receipt-effect-paper${printing ? " out" : ""}`}>
          <div className="receipt-effect-center">
            <b>{APP_NAME.toUpperCase()}</b><br />
            {APP_LOCATION}<br />
            {receipt.createdAt}
          </div>
          <hr />
          {receipt.items.map((item, index) => (
            <div className="receipt-effect-row" key={`${item.name}-${index}`}>
              <span>{item.qty} × {item.name}</span>
              <span>{formatMoney(item.price * item.qty)}</span>
            </div>
          ))}
          <hr />
          <div className="receipt-effect-row"><b>TOTAL {receipt.currency}</b><b>{formatMoney(total)}</b></div>
          <div className="receipt-effect-center receipt-effect-thanks">Receipt {receipt.receiptNumber}<br />Thank you!</div>
          <div className="receipt-effect-barcode" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
