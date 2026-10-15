import type { Metadata } from "next";
import { StorefrontShell } from "@/components/storefront";
import { PaymentPageClient } from "@/components/payment/payment-page-client";
import { getPesapalConfig } from "@/lib/payments/pesapal";

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
  const pesapalEnabled = Boolean(getPesapalConfig());

  return (
    <StorefrontShell>
      <PaymentPageClient
        orderId={params.orderId ?? ""}
        orderNumber={params.orderNumber ?? ""}
        total={Number(params.total ?? 0)}
        pesapalEnabled={pesapalEnabled}
      />
    </StorefrontShell>
  );
}
