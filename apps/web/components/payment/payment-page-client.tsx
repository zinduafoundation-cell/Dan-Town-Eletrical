"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  LockKeyhole,
  MapPin,
  Smartphone,
  WalletCards,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { clearPendingPaymentReminder } from "@/lib/pending-payment";
import { formatCurrency } from "@/lib/store-data";

type PaymentMethod = "mpesa" | "card" | "cash";

type Props = {
  orderId: string;
  orderNumber: string;
  total: number;
};

export function PaymentPageClient({
  orderId,
  orderNumber,
  total,
}: Props) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("mpesa");
  const [phone, setPhone] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

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

  const selectMethod = (value: PaymentMethod) => {
    setMethod(value);
    setError("");
  };

  const handlePayment = async () => {
    setError("");

    if (method === "mpesa" && !phone.trim()) {
      setError("Enter the M-Pesa phone number you want to use.");
      return;
    }

    setProcessing(true);

    try {
      /*
       * REAL PAYMENT ENGINE GOES HERE.
       *
       * Do NOT invent an API route if your project already has one.
       *
       * Connect this button to your existing payment/order service:
       *
       * 1. Create/confirm payment intent
       * 2. Send M-Pesa STK Push OR initialize card payment
       * 3. Wait for authenticated callback/webhook
       * 4. Update payment status
       * 5. Mark order as paid
       * 6. Finalize inventory
       * 7. Generate receipt/invoice
       * 8. Redirect to order confirmation
       */

      console.log({
        orderId,
        orderNumber,
        amount: total,
        method,
        phone,
      });

      /*
       * Temporary navigation until your real payment service
       * is connected.
       */
      router.push(
        `/order-confirmation?orderId=${encodeURIComponent(
          orderId
        )}&payment=${method}`
      );
    } catch {
      setError(
        "We could not start the payment. Please try again."
      );
      setProcessing(false);
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
              Choose your preferred payment method to complete
              your Dantown order securely.
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
                    Receive an STK Push on your phone.
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
                    Pay securely using your bank card.
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

          {/* MPESA */}
          {method === "mpesa" && (
            <div className="payment-section payment-input-section">
              <div className="section-heading">
                <div>
                  <span className="section-number">02</span>

                  <div>
                    <h2>M-Pesa number</h2>

                    <p>
                      We&apos;ll send a payment request to this
                      number.
                    </p>
                  </div>
                </div>
              </div>

              <label className="payment-label">
                M-Pesa phone number
              </label>

              <div className="phone-input">
                <Smartphone size={19} />

                <span>+254</span>

                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="712 345 678"
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                  aria-label="M-Pesa phone number"
                />
              </div>

              <div className="payment-help">
                <ShieldCheck size={16} />

                <span>
                  Keep your phone nearby. You&apos;ll receive
                  an M-Pesa payment prompt.
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
                    You&apos;ll be securely redirected to the
                    supported card payment gateway.
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
                    Pay when you collect your order or when
                    it is delivered, subject to your
                    fulfilment option.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ERROR */}
          {error && (
            <div className="payment-error">
              <AlertCircle size={18} />

              <span>{error}</span>
            </div>
          )}

          {/* ACTION */}
          <div className="payment-action">
            <button
              type="button"
              className="button button-primary payment-button"
              onClick={handlePayment}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2
                    size={19}
                    className="spin"
                  />

                  <span>
                    Starting payment...
                  </span>
                </>
              ) : (
                <>
                  <span>
                    {method === "cash"
                      ? "Confirm order"
                      : `Pay ${formatCurrency(total)}`}
                  </span>

                  <ArrowRight size={19} />
                </>
              )}
            </button>

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