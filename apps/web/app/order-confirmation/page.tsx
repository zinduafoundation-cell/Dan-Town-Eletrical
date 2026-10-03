import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { StorefrontShell } from "@/components/storefront";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Order Confirmed",
  description: "Your order has been successfully placed."
};

export default async function OrderConfirmationPage({
  searchParams
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const params = await searchParams;
  const rawId = params.orderId ?? "";
  let orderId = rawId || "unknown";

  if (rawId) {
    try {
      const supabase = createSupabaseServiceClient();
      const { data } = await supabase
        .from("orders")
        .select("order_number")
        .eq("id", rawId)
        .maybeSingle();
      if (data?.order_number) orderId = data.order_number;
    } catch {
      /* keep the id from the link */
    }
  }

  return (
    <StorefrontShell>
      <main className="page-shell">
        <div className="page-hero compact">
          <div>
            <p className="eyebrow">Success</p>
            <h1>Order confirmed</h1>
          </div>
        </div>

        <div className="confirmation-layout">
          <div className="confirmation-content">
            <div className="confirmation-icon">
              <Check size={48} />
            </div>
            <h2>Thank you for your order!</h2>
            <p>
              Your order has been successfully placed. We&apos;ll process it soon and
              you&apos;ll receive a confirmation with tracking information.
            </p>

            <div className="confirmation-details">
              <div className="detail-item">
                <span>Order ID</span>
                <strong>{orderId}</strong>
              </div>
            </div>

            <div className="confirmation-next-steps">
              <h3>What&apos;s next</h3>
              <ul>
                <li>Check your email for an order confirmation</li>
                <li>Our team will contact you to confirm fulfillment details</li>
                <li>Track your order status in your account</li>
              </ul>
            </div>

            <div className="confirmation-actions">
              <Link href="/shop" className="button button-primary">
                Continue shopping
              </Link>
              <Link href="/" className="button button-secondary">
                Back home
              </Link>
            </div>
          </div>

          <aside className="confirmation-sidebar">
            <h3>Questions</h3>
            <p>Contact us at :</p>
            <div className="contact-info">
              <p>
                <strong>Dantown Electrical</strong>
              </p>
              <p>Kitale, Kenya</p>
              <p>Phone : +254 (0)...</p>
              <p>Email : info@dantown.co.ke</p>
            </div>
          </aside>
        </div>
      </main>
    </StorefrontShell>
  );
}