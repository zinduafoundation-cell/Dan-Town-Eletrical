"use client";import { ReactNode } from "react";
import { CartProvider } from "@/components/cart/cart-provider";
import { PendingPaymentReminder } from "@/components/pending-payment-reminder";
export function Providers({ children } : { children: ReactNode }) {return (<CartProvider>{children}<PendingPaymentReminder /></CartProvider>);
}
