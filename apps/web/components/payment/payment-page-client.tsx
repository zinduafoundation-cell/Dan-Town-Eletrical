"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CreditCard,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  clearPendingPaymentReminder,
  getPaymentAccessTokenFromLocation,
  readPendingPaymentReminder
} from "@/lib/pending-payment";
import { formatCurrency } from "@/lib/store-data";

type Props = {
  orderId: string;
  orderNumber: string;
  total: number;
  pesapalEnabled: boolean;
};

export function PaymentPageClient({
  orderId,
  orderNumber,
  total,
  pesapalEnabled,
}: Props) {
  const [paymentToken, setPaymentToken] = useState("");
  const [paymentTokenReady, setPaymentTokenReady] = useState(false);
  const [email, setEmail] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [startingPayment, setStartingPayment] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    const pending = readPendingPaymentReminder();
    const fallbackToken = pending?.orderId === orderId ? pending.paymentToken : undefined;
    const frame = window.requestAnimationFrame(() => {
      const token = getPaymentAccessTokenFromLocation(window.location.hash, fallbackToken);
      setPaymentToken(token);
      setPaymentTokenReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [orderId]);

  useEffect(() => {
    clearPendingPaymentReminder();
  }, []);

  if (!orderId) {
    return (
      <main className="page-shell payment-page">
        <div className="payment-empty">
          <AlertCircle size={42} />

          <h1>Payment session not found</h1>

          <p>
            Your payment session could not be found. Return to your cart
            and start checkout again.
          </p>

          <Link
            href="/cart"
            className="button button-primary"
          >
            Return to cart
          </Link>
        </div>
      </main>
    );
  }

  if (!paymentTokenReady) {
    return (
      <main className="page-shell payment-page">
        <div className="payment-empty">
          <Loader2 className="animate-spin" size={32} />
          <h1>Preparing secure payment</h1>
        </div>
      </main>
    );
  }

  if (!paymentToken) {
    return (
      <main className="page-shell payment-page">
        <div className="payment-empty">
          <AlertCircle size={42} />
          <h1>Payment session not found</h1>
          <p>Return to your cart and start checkout again.</p>
          <Link href="/cart" className="button button-primary">Return to cart</Link>
        </div>
      </main>
    );
  }

  const startPesapalCheckout = async () => {
    setStartingPayment(true);
    setPaymentError("");
    try {
      const response = await fetch("/api/checkout/pesapal-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, email, paymentToken })
      });
      const result: unknown = await response.json();
      if (
        !response.ok ||
        typeof result !== "object" ||
        result === null ||
        !("redirectUrl" in result) ||
        typeof result.redirectUrl !== "string"
      ) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Unable to start Pesapal checkout.";
        throw new Error(message);
      }
      window.sessionStorage.setItem(`dantown-payment-token:${orderId}`, paymentToken);
      window.location.assign(result.redirectUrl);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Unable to start Pesapal checkout.");
      setStartingPayment(false);
    }
  };

  return (
    <main className="page-shell payment-page">
      {/* TOP BAR */}
      <div className="payment-topbar">
        <Link
          href="/checkout"
          className="payment-back"
        >
          <ArrowLeft size={18} />
          <span>Back to checkout</span>
        </Link>

        <div className="payment-security">
          <LockKeyhole size={16} />
          <span>Secure checkout</span>
        </div>
      </div>

      {/* PROGRESS */}
      <div
        className="checkout-progress"
        aria-label="Checkout progress"
      >
        <div className="checkout-step complete">
          <span>
            <Check size={15} />
          </span>
          <strong>Cart</strong>
        </div>

        <div className="checkout-line complete" />

        <div className="checkout-step complete">
          <span>
            <Check size={15} />
          </span>
          <strong>Details</strong>
        </div>

        <div className="checkout-line active" />

        <div className="checkout-step active">
          <span>3</span>
          <strong>Payment</strong>
        </div>
      </div>

      <div className="payment-layout">
        {/* MAIN PAYMENT CARD */}
        <section className="payment-main">
          <div className="payment-heading">
            <span className="payment-eyebrow">
              ORDER {orderNumber}
            </span>

            <h1>Complete your payment</h1>

            <p>
              Your order will be sent for processing only after Pesapal confirms the payment directly with our server.
            </p>
          </div>

          {/* PAYMENT METHODS */}
          <div className="payment-section">
            <div className="section-heading">
              <div>
                <span className="section-number">01</span>
                <div>
                  <h2>Payment method</h2>
                  <p>Pesapal is the only available payment provider.</p>
                </div>
              </div>
            </div>

            <div className="payment-methods">
            <div className="payment-method selected" aria-current="true">
              <div className="method-icon">
                <CreditCard size={22} />
              </div>
              <div className="method-content">
                <div className="method-title">
                  <strong>Pesapal</strong>
                  <span className="recommended">Secure checkout</span>
                </div>
                <p>Pay using the payment methods enabled securely in Pesapal checkout.</p>
              </div>
              <div className="method-radio">
                <Check size={15} />
              </div>
            </div>
            </div>
          </div>

          <div className="payment-section payment-input-section">
            <div className="section-heading">
              <div>
                <span className="section-number">02</span>
                <div>
                  <h2>Email for Pesapal</h2>
                  <p>Pesapal uses this address for the secure payment session.</p>
                </div>
              </div>
              </div>
              <label className="form-field">
                <span>Email address</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              {!pesapalEnabled && (
                <div className="payment-help">
                  <AlertCircle size={16} />
                  <span>Pesapal is not configured on this deployment yet. Contact the Dantown administrator.</span>
                </div>
              )}
          </div>

          {/* ACTION */}
          <div className="payment-action">
            <button
              type="button"
              className="button button-primary payment-button"
              onClick={startPesapalCheckout}
              disabled={!pesapalEnabled || !email.trim() || startingPayment || !paymentToken}
            >
              {startingPayment ? <Loader2 className="animate-spin" size={18} /> : null}
              <span>{pesapalEnabled ? "Continue to Pesapal" : "Pesapal unavailable"}</span>
            </button>
            {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}

            <Link
              className="button button-secondary payment-button"
              href={`/order-confirmation?orderId=${encodeURIComponent(orderId)}`}
            >
              View order status
            </Link>

            <p className="payment-protection">
              <LockKeyhole size={15} />
              Your payment information is protected.
            </p>
          </div>
        </section>

        {/* ORDER SUMMARY */}
        <aside className="payment-summary">
          <div className="summary-header">
            <span>YOUR ORDER</span>

            <strong>{orderNumber}</strong>
          </div>

          <div className="summary-total">
            <span>Total to pay</span>

            <strong>
              {formatCurrency(total)}
            </strong>

            <small>KES</small>
          </div>

          <div className="summary-divider" />

          <div className="summary-row">
            <span>Payment</span>

            <strong>Pesapal</strong>
          </div>

          <div className="summary-row">
            <span>Order</span>

            <strong>{orderNumber}</strong>
          </div>

          <div className="summary-divider" />

          <div className="summary-security">
            <ShieldCheck size={20} />

            <div>
              <strong>Shop with confidence</strong>

              <p>
                Genuine electrical and solar products
                backed by Dantown support.
              </p>
            </div>
          </div>

          <div className="summary-location">
            <MapPin size={18} />

            <div>
              <strong>Dantown Electrical</strong>

              <span>
                Kitale, Kenya
              </span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}