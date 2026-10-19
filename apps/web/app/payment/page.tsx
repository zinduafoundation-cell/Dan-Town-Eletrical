import type { Metadata } from "next";
import { StorefrontShell } from "@/components/storefront";
import { PaymentPageClient } from "@/components/payment/payment-page-client";
import { loadPaymentProviderReadiness, loadPaymentProviderSettings } from "@/lib/payments/payment-provider-settings";

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
  const { settings } = await loadPaymentProviderSettings();
  const readiness = await loadPaymentProviderReadiness(settings);
  const enabledProviders = [
    ...(readiness.pesapal.online ? ["PESAPAL" as const] : []),
    ...(readiness.paystack.online ? ["PAYSTACK" as const] : []),
  ];

  return (
    <StorefrontShell>
      <PaymentPageClient
        orderId={params.orderId ?? ""}
        orderNumber={params.orderNumber ?? ""}
        total={Number(params.total ?? 0)}
        enabledProviders={enabledProviders}
      />
    </StorefrontShell>
  );
}
