"use client";

import { ReactNode } from "react";
import { CartProvider } from "@/components/cart/cart-provider";
import { PendingPaymentReminder } from "@/components/pending-payment-reminder";
import { CompareTray } from "@/components/compare/compare-tray";
import { DatabaseDataRefresh } from "@/components/database-data-refresh";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      {children}
      <DatabaseDataRefresh />
      <PendingPaymentReminder />
      <CompareTray />
    </CartProvider>
  );
}
