import Link from "next/link";

export default function RetiredPaymentCallbackPage() {
  return (
    <main className="page-shell payment-page">
      <section className="payment-empty">
        <p className="payment-eyebrow">Payment provider updated</p>
        <h1>Paystack checkout is no longer available</h1>
        <p>Pesapal is now the only supported payment provider. Return to your order to start a Pesapal payment.</p>
        <Link href="/cart" className="button button-primary">Return to checkout</Link>
      </section>
    </main>
  );
}
