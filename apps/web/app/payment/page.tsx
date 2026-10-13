import type { Metadata } from "next";
import { StorefrontShell } from "@/components/storefront";
import { PaymentPageClient } from "@/components/payment/payment-page-client";
import { getPaystackMode } from "@/lib/payments/paystack-mode";
import { isPaywaveConfigured } from "@/lib/payments/paywave";

export const metadata: Metadata = {
  title: "Payment",
  description: "Choose how you would like to complete your Dantown Electrical order."
};

export default async function PaymentPage({
  searchParams
}: {
  searchParams: Promise<{ orderId?: string; orderNumber?: string; total?: string }>;
}) {
  const params = await searchParams;
  const paystackMode = getPaystackMode();
  const paywaveEnabled = isPaywaveConfigured();

  return (
    <StorefrontShell>
      <PaymentPageClient
        orderId={params.orderId ?? ""}
        orderNumber={params.orderNumber ?? ""}
        total={Number(params.total ?? 0)}
        paystackMode={paystackMode}
        paywaveEnabled={paywaveEnabled}
      />
    </StorefrontShell>
  );
}
