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
import {
  clearPendingPaymentReminder,
  getPaymentAccessTokenFromLocation,
  readPendingPaymentReminder
} from "@/lib/pending-payment";
import { formatCurrency } from "@/lib/store-data";
import type { PaystackMode } from "@/lib/payments/paystack-mode";

type PaymentMethod = "paystack" | "mpesa" | "card" | "cash";

type Props = {
  orderId: string;
  orderNumber: string;
  total: number;
  paystackMode: PaystackMode | null;
  paywaveEnabled: boolean;
};

export function PaymentPageClient({
  orderId,
  orderNumber,
  total,
  paystackMode,
  paywaveEnabled,
}: Props) {
  const [method, setMethod] = useState<PaymentMethod>("paystack");
  const [paymentToken, setPaymentToken] = useState("");
  const [paymentTokenReady, setPaymentTokenReady] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paywaveTransactionRequestId, setPaywaveTransactionRequestId] = useState("");
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

  const checkPaywaveStatus = async (transactionRequestId: string) => {
    setStartingPayment(true);
    setPaymentError("");
    try {
      for (let attempt = 0; attempt < 18; attempt += 1) {
        if (attempt > 0) await new Promise((resolve) => window.setTimeout(resolve, 5_000));
        const response = await fetch("/api/checkout/paywave-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionRequestId, paymentToken }),
        });
        const result: unknown = await response.json();
        if (response.status === 202 && typeof result === "object" && result !== null && "status" in result && result.status === "pending") {
          continue;
        }
        if (response.status === 402) {
          setPaywaveTransactionRequestId("");
          throw new Error(
            typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
              ? result.error
              : "M-Pesa payment was not completed. You can try again.",
          );
        }
        if (!response.ok || typeof result !== "object" || result === null ||
          !("success" in result) || result.success !== true ||
          !("orderId" in result) || typeof result.orderId !== "string") {
          throw new Error(
            typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
              ? result.error
              : "Unable to verify the M-Pesa payment.",
          );
        }
        window.location.replace(`/order-confirmation?orderId=${encodeURIComponent(result.orderId)}`);
        return;
      }
      setPaymentError("The M-Pesa request is still pending. Check your phone, then select “Check payment status” again.");
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Unable to verify the M-Pesa payment.");
    } finally {
      setStartingPayment(false);
    }
  };

  const startPaywaveCheckout = async () => {
    setStartingPayment(true);
    setPaymentError("");
    try {
      const response = await fetch("/api/checkout/paywave-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, phone, paymentToken }),
      });
      const result: unknown = await response.json();
      if (!response.ok || typeof result !== "object" || result === null ||
        !("transactionRequestId" in result) || typeof result.transactionRequestId !== "string") {
        throw new Error(
          typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "Unable to send the M-Pesa payment request.",
        );
      }
      setPaywaveTransactionRequestId(result.transactionRequestId);
      await checkPaywaveStatus(result.transactionRequestId);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Unable to start M-Pesa payment.");
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
              {method === "mpesa"
                ? "Approve the M-Pesa prompt on your phone. Your order is confirmed only after Paywave Express verifies the payment."
                : paystackMode === "test"
                  ? "Your order is saved. Paystack sandbox testing does not collect real money."
                  : "Your order is saved. Complete payment securely with Paystack to send it to Dantown for processing."}
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
                    <strong>{paystackMode === "test" ? "Paystack sandbox" : "Paystack"}</strong>
                    {paystackMode === "test" ? <span className="recommended">Test only</span> : null}
                  </div>
                  <p>
                    {paystackMode === "test"
                      ? "Use Paystack test credentials to simulate a payment. No real charge."
                      : "Pay securely with Paystack. Confirmed payments are sent to Dantown for processing."}
                  </p>
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
                    <strong>M-Pesa via Paywave Express</strong>

                    <span className="recommended">
                      Recommended
                    </span>
                  </div>

                  <p>
                    {paywaveEnabled
                      ? "Get a secure STK Push on your phone and approve with your M-Pesa PIN."
                      : "Paywave Express is not configured for this deployment yet."}
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
              {!paystackMode && (
                <div className="payment-help">
                  <AlertCircle size={16} />
                  <span>Paystack is not enabled on this deployment.</span>
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

                    <p>Paywave Express will send an M-Pesa STK Push to this Kenyan phone number.</p>
                  </div>
                </div>
              </div>

              <label className="form-field">
                <span>M-Pesa phone number</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0712 345 678"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  disabled={!paywaveEnabled || startingPayment}
                  required
                />
              </label>
              <div className="payment-help">
                <ShieldCheck size={16} />
                <span>Never share your M-Pesa PIN. Dantown will confirm the order only after Paywave Express verifies the transaction.</span>
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
              onClick={method === "mpesa" ? () => {
                if (paywaveTransactionRequestId) void checkPaywaveStatus(paywaveTransactionRequestId);
                else void startPaywaveCheckout();
              } : startPaystackCheckout}
              disabled={
                (method === "paystack" && !paystackMode) ||
                (method === "mpesa" && (!paywaveEnabled || phone.trim().length < 9)) ||
                (method !== "paystack" && method !== "mpesa") ||
                startingPayment || !paymentToken
              }
            >
              {startingPayment ? <Loader2 className="animate-spin" size={18} /> : null}
              <span>
                {method === "mpesa"
                  ? paywaveTransactionRequestId
                    ? "Check payment status"
                    : "Send M-Pesa prompt"
                  : paystackMode
                    ? `Continue to Paystack${paystackMode === "test" ? " sandbox" : ""}`
                    : "Paystack unavailable"}
              </span>
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
                ? "M-Pesa · Paywave Express"
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