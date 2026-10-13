"use client";

import { useEffect, useRef, useState } from "react";
import { APP_NAME } from "@dantown/shared";
import type { ReceiptEffectSale } from "@/lib/pos/receipt-effect";

type ActiveReceipt = ReceiptEffectSale & { key: number };

export function ReceiptEffect() {
  const [receipt, setReceipt] = useState<ActiveReceipt | null>(null);
  const [visible, setVisible] = useState(false);
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
      setReceipt({ ...sale, key: ++sequence.current });
      animationFrame.current = window.requestAnimationFrame(() => {
        setVisible(true);
        animationFrame.current = null;
      });

      timers.current.push(window.setTimeout(() => {
        setVisible(false);
        setReceipt(null);
      }, 4500));
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
          <div><b>Sale complete</b><div className="receipt-effect-meta">Receipt {receipt.receiptNumber} · {receipt.items.length} items</div></div>
          <div className="receipt-effect-amount">{receipt.currency} {formatMoney(total)}</div>
        </div>
      </div>
    </div>
  );
}
