"use client";import { ReactNode } from "react";
import { CartProvider } from "@/components/cart/cart-provider";
import { PendingPaymentReminder } from "@/components/pending-payment-reminder";
import { CookieConsent } from "@/components/cookie-consent";
export function Providers({ children } : { children: ReactNode }) {return (<CartProvider>{children}<PendingPaymentReminder /><CookieConsent /></CartProvider>);
}
