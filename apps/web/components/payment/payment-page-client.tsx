"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CreditCard,
  LockKeyhole,
  MapPin,
  Smartphone,
  WalletCards,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { clearPendingPaymentReminder } from "@/lib/pending-payment";
import { formatCurrency } from "@/lib/store-data";

type PaymentMethod = "paystack" | "mpesa" | "card" | "cash";

type Props = {
  orderId: string;
  orderNumber: string;
  total: number;
  paystackEnabled: boolean;
};

export function PaymentPageClient({
  orderId,
  orderNumber,
  total,
  paystackEnabled,
}: Props) {
  const [method, setMethod] = useState<PaymentMethod>("paystack");
  const [paymentToken, setPaymentToken] = useState("");
  const [paymentTokenReady, setPaymentTokenReady] = useState(false);
  const [email, setEmail] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [startingPayment, setStartingPayment] = useState(false);

  useEffect(() => {
    clearPendingPaymentReminder();
  }, []);

  useEffect(() => {
    if (!orderId) return;
    const frame = window.requestAnimationFrame(() => {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("paymentToken") ?? "";
      setPaymentToken(token);
      setPaymentTokenReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [orderId]);

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

  const selectMethod = (value: PaymentMethod) => {
    setMethod(value);
    setPaymentError("");
  };

  const startPaystackCheckout = async () => {
    setStartingPayment(true);
    setPaymentError("");
    try {
      const response = await fetch("/api/checkout/paystack-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, email, paymentToken })
      });
      const result: unknown = await response.json();
      if (
        !response.ok ||
        typeof result !== "object" ||
        result === null ||
        !("authorizationUrl" in result) ||
        typeof result.authorizationUrl !== "string"
      ) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Unable to start Paystack checkout.";
        throw new Error(message);
      }
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Unable to start Paystack checkout.");
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
              Your order is saved. Paystack sandbox testing does not collect real money.
            </p>
          </div>

          {/* PAYMENT METHODS */}
          <div className="payment-section">
            <div className="section-heading">
              <div>
                <span className="section-number">01</span>
                <div>
                  <h2>Payment method</h2>
                  <p>Select how you want to pay.</p>
                </div>
              </div>
            </div>

            <div className="payment-methods">
              <button
                type="button"
                className={`payment-method ${method === "paystack" ? "selected" : ""}`}
                onClick={() => selectMethod("paystack")}
              >
                <div className="method-icon">
                  <CreditCard size={22} />
                </div>
                <div className="method-content">
                  <div className="method-title">
                    <strong>Paystack sandbox</strong>
                    <span className="recommended">Test only</span>
                  </div>
                  <p>Use Paystack test credentials to simulate a payment. No real charge.</p>
                </div>
                <div className="method-radio">
                  {method === "paystack" && <Check size={15} />}
                </div>
              </button>

              {/* MPESA */}
              <button
                type="button"
                className={`payment-method ${
                  method === "mpesa"
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  selectMethod("mpesa")
                }
              >
                <div className="method-icon mpesa-icon">
                  <Smartphone size={22} />
                </div>

                <div className="method-content">
                  <div className="method-title">
                    <strong>M-Pesa</strong>

                    <span className="recommended">
                      Recommended
                    </span>
                  </div>

                  <p>
                    M-Pesa payments are not available yet.
                  </p>
                </div>

                <div className="method-radio">
                  {method === "mpesa" && (
                    <Check size={15} />
                  )}
                </div>
              </button>

              {/* CARD */}
              <button
                type="button"
                className={`payment-method ${
                  method === "card"
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  selectMethod("card")
                }
              >
                <div className="method-icon">
                  <CreditCard size={22} />
                </div>

                <div className="method-content">
                  <strong>Debit / Credit Card</strong>

                  <p>
                    Card payments are not available yet.
                  </p>
                </div>

                <div className="method-radio">
                  {method === "card" && (
                    <Check size={15} />
                  )}
                </div>
              </button>

              {/* CASH */}
              <button
                type="button"
                className={`payment-method ${
                  method === "cash"
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  selectMethod("cash")
                }
              >
                <div className="method-icon">
                  <WalletCards size={22} />
                </div>

                <div className="method-content">
                  <strong>Cash</strong>

                  <p>
                    Pay when collecting or receiving your order.
                  </p>
                </div>

                <div className="method-radio">
                  {method === "cash" && (
                    <Check size={15} />
                  )}
                </div>
              </button>
            </div>
          </div>

          {method === "paystack" && (
            <div className="payment-section payment-input-section">
              <div className="section-heading">
                <div>
                  <span className="section-number">02</span>
                  <div>
                    <h2>Email for Paystack</h2>
                    <p>Paystack requires an email address to open its secure checkout.</p>
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
              {!paystackEnabled && (
                <div className="payment-help">
                  <AlertCircle size={16} />
                  <span>Paystack sandbox is not enabled on this deployment.</span>
                </div>
              )}
            </div>
          )}

          {/* MPESA */}
          {method === "mpesa" && (
            <div className="payment-section payment-input-section">
              <div className="section-heading">
                <div>
                  <span className="section-number">02</span>

                  <div>
                    <h2>M-Pesa number</h2>

                    <p>
                      M-Pesa checkout is not connected. No phone number or payment request is needed.
                    </p>
                  </div>
                </div>
              </div>

              <div className="payment-help">
                <ShieldCheck size={16} />

                <span>
                  No M-Pesa prompt will be sent until payment processing is enabled.
                </span>
              </div>
            </div>
          )}

          {/* CARD */}
          {method === "card" && (
            <div className="payment-section">
              <div className="card-coming">
                <CreditCard size={28} />

                <div>
                  <strong>Secure card payment</strong>

                  <p>
                    The card payment gateway is not connected yet.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CASH */}
          {method === "cash" && (
            <div className="payment-section">
              <div className="cash-info">
                <MapPin size={23} />

                <div>
                  <strong>Cash payment</strong>

                  <p>
                    Cash payment instructions are not recorded online yet. Contact Dantown to arrange payment.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ACTION */}
          <div className="payment-action">
            <button
              type="button"
              className="button button-primary payment-button"
              onClick={startPaystackCheckout}
              disabled={!paystackEnabled || method !== "paystack" || startingPayment || !paymentToken}
            >
              {startingPayment ? <Loader2 className="animate-spin" size={18} /> : null}
              <span>{paystackEnabled ? "Continue to Paystack sandbox" : "Paystack sandbox unavailable"}</span>
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

            <strong>
              {method === "mpesa"
                ? "M-Pesa"
                : method === "card"
                ? "Card"
                : "Cash"}
            </strong>
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