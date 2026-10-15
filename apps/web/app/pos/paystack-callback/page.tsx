import Link from "next/link";

export default function RetiredPOSPaymentCallbackPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Payment provider updated</p>
        <h1>Paystack checkout is no longer available</h1>
        <p>Pesapal is the only supported POS payment provider. Start a new sale from the register.</p>
        <Link className="button button-primary" href="/pos/new-sale">Return to POS</Link>
      </section>
    </main>
  );
}
