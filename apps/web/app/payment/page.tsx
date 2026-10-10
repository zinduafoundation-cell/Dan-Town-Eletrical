import type { Metadata } from "next";
import { StorefrontShell } from "@/components/storefront";
import { PaymentPageClient } from "@/components/payment/payment-page-client";

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
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  const paystackEnabled = secretKey?.startsWith("sk_test_") ?? false;

  return (
    <StorefrontShell>
      <PaymentPageClient
        orderId={params.orderId ?? ""}
        orderNumber={params.orderNumber ?? ""}
        total={Number(params.total ?? 0)}
        paystackEnabled={paystackEnabled}
      />
    </StorefrontShell>
  );
}
