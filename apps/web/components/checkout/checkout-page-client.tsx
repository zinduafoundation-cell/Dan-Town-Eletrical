"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  CreditCard,
  Home,
  LockKeyhole,
  MapPin,
  Phone,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
  User,
} from "lucide-react";
import { formatCurrency } from "@/lib/store-data";

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  brand?: string;
};

type Props = {
  cartItems?: CartItem[];
  subtotal?: number;
  deliveryFee?: number;
  discount?: number;
};

type Fulfilment = "pickup" | "delivery";

type FormState = {
 fullName: string;
  phone: string;
  email: string;
  county: string;
  town: string;
  address: string;
  notes: string;
};

const initialForm: FormState = {
  fullName: "",
  phone: "",
  email: "",
  county: "Trans Nzoia",
  town: "Kitale",
  address: "",
  notes: "",
};

export default function CheckoutClient({
  cartItems = [],
  subtotal = 0,
  deliveryFee = 0,
  discount = 0,
}: Props) {
  const [fulfilment, setFulfilment] =
    useState<Fulfilment>("pickup");

  const [form, setForm] = useState<FormState>(initialForm);

  const [errors, setErrors] =
    useState<Partial<Record<keyof FormState, string>>>({});

  const [loading, setLoading] = useState(false);

  const [showNotes, setShowNotes] = useState(false);

  const finalDeliveryFee =
    fulfilment === "delivery" ? deliveryFee : 0;

  const total = useMemo(() => {
    return Math.max(
      0,
      subtotal + finalDeliveryFee - discount
    );
  }, [subtotal, finalDeliveryFee, discount]);

  function updateField(
    field: keyof FormState,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((current) => ({
        ...current,
        [field]: undefined,
      }));
    }
  }

  function validate() {
    const nextErrors: Partial<
      Record<keyof FormState, string>
    > = {};

    if (!form.fullName.trim()) {
      nextErrors.fullName = "Enter your full name.";
    }

    if (!form.phone.trim()) {
      nextErrors.phone = "Enter your phone number.";
    } else if (
      !/^(\+254|254|0)?7\d{8}$/.test(
        form.phone.replace(/\s+/g, "")
      )
    ) {
      nextErrors.phone =
        "Enter a valid Kenyan phone number.";
    }

    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email
      )
    ) {
      nextErrors.email =
        "Enter a valid email address.";
    }

    if (fulfilment === "delivery") {
      if (!form.town.trim()) {
        nextErrors.town = "Enter your town.";
      }

      if (!form.address.trim()) {
        nextErrors.address =
          "Enter your delivery location.";
      }
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    if (cartItems.length === 0) {
      return;
    }

    setLoading(true);

    try {
      /*
       * IMPORTANT:
       *
       * Connect this section to your EXISTING checkout/order API.
       *
       * Example:
       *
       * const response = await fetch("/api/orders", {
       *   method: "POST",
       *   headers: {
       *     "Content-Type": "application/json",
       *   },
       *   body: JSON.stringify({
       *     customer: form,
       *     fulfilment,
       *     items: cartItems,
       *     subtotal,
       *     deliveryFee: finalDeliveryFee,
       *     discount,
       *     total,
       *   }),
       * });
       *
       * const order = await response.json();
       *
       * window.location.href =
       *   `/payment?orderId=${order.id}&orderNumber=${order.orderNumber}`;
       */

      console.log("Checkout data:", {
        customer: form,
        fulfilment,
        items: cartItems,
        subtotal,
        deliveryFee: finalDeliveryFee,
        discount,
        total,
      });
    } finally {
      setLoading(false);
    }
  }

  if (cartItems.length === 0) {
    return (
      <main className="checkout-page">
        <div className="checkout-empty">

          <div className="checkout-empty-icon">
            <Truck size={30} />
          </div>

          <p className="checkout-eyebrow">
            DANTOWN ELECTRICAL
          </p>

          <h1>Your cart is empty</h1>

          <p>
            Add electrical, solar or lighting products
            before continuing to checkout.
          </p>

          <Link
            href="/shop"
            className="checkout-primary-button"
          >
            Shop products
            <ArrowRight size={18} />
          </Link>

        </div>
      </main>
    );
  }

  return (
    <main className="checkout-page">

      {/* ==================================================
          TOP BAR
      ================================================== */}

      <header className="checkout-header">

        <Link
          href="/cart"
          className="checkout-back"
        >
          <ArrowLeft size={17} />
          Back to cart
        </Link>

        <div className="checkout-secure">
          <LockKeyhole size={15} />
          Secure checkout
        </div>

      </header>


      {/* ==================================================
          PROGRESS
      ================================================== */}

      <div className="checkout-progress">

        <div className="checkout-step completed">
          <span>
            <Check size={14} />
          </span>

          <div>
            <strong>Cart</strong>
            <small>Review items</small>
          </div>
        </div>

        <div className="checkout-progress-line active" />

        <div className="checkout-step active">
          <span>2</span>

          <div>
            <strong>Details</strong>
            <small>Delivery information</small>
          </div>
        </div>

        <div className="checkout-progress-line" />

        <div className="checkout-step">
          <span>3</span>

          <div>
            <strong>Payment</strong>
            <small>Complete order</small>
          </div>
        </div>

      </div>


      {/* ==================================================
          MAIN
      ================================================== */}

      <div className="checkout-layout">

        {/* =================================================
            LEFT
        ================================================= */}

        <form
          className="checkout-main"
          onSubmit={handleSubmit}
        >

          {/* HERO */}

          <section className="checkout-intro">

            <div>

              <p className="checkout-eyebrow">
                CHECKOUT
              </p>

              <h1>
                Let us get your
                <span> order moving.</span>
              </h1>

              <p>
                Tell us where to send your products or
                choose store pickup from Dantown Electrical
                in Kitale.
              </p>

            </div>

            <div className="checkout-trust">

              <ShieldCheck size={22} />

              <div>
                <strong>Trusted by Kitale</strong>

                <small>
                  Genuine electrical & solar products
                </small>
              </div>

            </div>

          </section>


          {/* =================================================
              CUSTOMER DETAILS
          ================================================= */}

          <section className="checkout-section">

            <div className="checkout-section-heading">

              <span className="checkout-section-number">
                01
              </span>

              <div>
                <h2>Your details</h2>

                <p>
                  We need these details to process your
                  order.
                </p>
              </div>

            </div>


            <div className="checkout-fields">

              {/* NAME */}

              <div className="checkout-field">

                <label htmlFor="fullName">
                  Full name
                </label>

                <div
                  className={
                    errors.fullName
                      ? "checkout-input error"
                      : "checkout-input"
                  }
                >
                  <User size={18} />

                  <input
                    id="fullName"
                    value={form.fullName}
                    onChange={(event) =>
                      updateField(
                        "fullName",
                        event.target.value
                      )
                    }
                    placeholder="e.g. Brian Kiptoo"
                    autoComplete="name"
                  />
                </div>

                {errors.fullName && (
                  <small className="field-error">
                    {errors.fullName}
                  </small>
                )}

              </div>


              {/* PHONE */}

              <div className="checkout-field">

                <label htmlFor="phone">
                  Phone number
                </label>

                <div
                  className={
                    errors.phone
                      ? "checkout-input error"
                      : "checkout-input"
                  }
                >
                  <Phone size={18} />

                  <input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(event) =>
                      updateField(
                        "phone",
                        event.target.value
                      )
                    }
                    placeholder="0712 345 678"
                    autoComplete="tel"
                  />
                </div>

                {errors.phone && (
                  <small className="field-error">
                    {errors.phone}
                  </small>
                )}

              </div>


              {/* EMAIL */}

              <div className="checkout-field full">

                <label htmlFor="email">
                  Email address
                  <span>Optional</span>
                </label>

                <div
                  className={
                    errors.email
                      ? "checkout-input error"
                      : "checkout-input"
                  }
                >
                  <Smartphone size={18} />

                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      updateField(
                        "email",
                        event.target.value
                      )
                    }
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>

                {errors.email && (
                  <small className="field-error">
                    {errors.email}
                  </small>
                )}

              </div>

            </div>

          </section>


          {/* =================================================
              FULFILMENT
          ================================================= */}

          <section className="checkout-section">

            <div className="checkout-section-heading">

              <span className="checkout-section-number">
                02
              </span>

              <div>
                <h2>How should we fulfil your order?</h2>

                <p>
                  Choose the option that works best for you.
                </p>
              </div>

            </div>


            <div className="fulfilment-options">

              {/* PICKUP */}

              <button
                type="button"
                className={
                  fulfilment === "pickup"
                    ? "fulfilment-option selected"
                    : "fulfilment-option"
                }
                onClick={() =>
                  setFulfilment("pickup")
                }
              >

                <div className="fulfilment-option-icon">
                  <Store size={23} />
                </div>

                <div className="fulfilment-option-content">

                  <div className="fulfilment-option-title">
                    <strong>
                      Pick up from Dantown
                    </strong>

                    {fulfilment === "pickup" && (
                      <span>
                        <Check size={13} />
                      </span>
                    )}
                  </div>

                  <p>
                    Collect your order from our Kitale
                    store.
                  </p>

                  <small>
                    <MapPin size={13} />
                    Kitale · Store pickup
                  </small>

                </div>

              </button>


              {/* DELIVERY */}

              <button
                type="button"
                className={
                  fulfilment === "delivery"
                    ? "fulfilment-option selected"
                    : "fulfilment-option"
                }
                onClick={() =>
                  setFulfilment("delivery")
                }
              >

                <div className="fulfilment-option-icon">
                  <Truck size={23} />
                </div>

                <div className="fulfilment-option-content">

                  <div className="fulfilment-option-title">

                    <strong>
                      Deliver to me
                    </strong>

                    {fulfilment === "delivery" && (
                      <span>
                        <Check size={13} />
                      </span>
                    )}

                  </div>

                  <p>
                    We will arrange delivery to your
                    preferred location.
                  </p>

                  <small>
                    <Clock3 size={13} />
                    Delivery charges confirmed
                  </small>

                </div>

              </button>

            </div>

          </section>


          {/* =================================================
              DELIVERY LOCATION
          ================================================= */}

          {fulfilment === "delivery" && (
            <section className="checkout-section delivery-section">

              <div className="checkout-section-heading">

                <span className="checkout-section-number">
                  03
                </span>

                <div>
                  <h2>Delivery location</h2>

                  <p>
                    Where should we deliver your order?
                  </p>
                </div>

              </div>


              <div className="checkout-fields">

                {/* COUNTY */}

                <div className="checkout-field">

                  <label htmlFor="county">
                    County
                  </label>

                  <div className="checkout-input">

                    <MapPin size={18} />

                    <select
                      id="county"
                      value={form.county}
                      onChange={(event) =>
                        updateField(
                          "county",
                          event.target.value
                        )
                      }
                    >
                      <option>
                        Trans Nzoia
                      </option>

                      <option>
                        Uasin Gishu
                      </option>

                      <option>
                        Bungoma
                      </option>

                      <option>
                        Kakamega
                      </option>

                      <option>
                        Other
                      </option>

                    </select>

                    <ChevronDown size={16} />

                  </div>

                </div>


                {/* TOWN */}

                <div className="checkout-field">

                  <label htmlFor="town">
                    Town / Area
                  </label>

                  <div
                    className={
                      errors.town
                        ? "checkout-input error"
                        : "checkout-input"
                    }
                  >

                    <MapPin size={18} />

                    <input
                      id="town"
                      value={form.town}
                      onChange={(event) =>
                        updateField(
                          "town",
                          event.target.value
                        )
                      }
                      placeholder="Kitale"
                    />

                  </div>

                  {errors.town && (
                    <small className="field-error">
                      {errors.town}
                    </small>
                  )}

                </div>


                {/* ADDRESS */}

                <div className="checkout-field full">

                  <label htmlFor="address">
                    Delivery location
                  </label>

                  <div
                    className={
                      errors.address
                        ? "checkout-input error textarea-input"
                        : "checkout-input textarea-input"
                    }
                  >

                    <Home size={18} />

                    <textarea
                      id="address"
                      value={form.address}
                      onChange={(event) =>
                        updateField(
                          "address",
                          event.target.value
                        )
                      }
                      placeholder="Estate, building, street or a nearby landmark"
                      rows={3}
                    />

                  </div>

                  {errors.address && (
                    <small className="field-error">
                      {errors.address}
                    </small>
                  )}

                </div>

              </div>

            </section>
          )}


          {/* =================================================
              ORDER NOTES
          ================================================= */}

          <section className="checkout-notes">

            <button
              type="button"
              onClick={() =>
                setShowNotes((value) => !value)
              }
            >
              <span>
                <CreditCard size={17} />
                Add an order note
              </span>

              <ChevronDown
                size={17}
                className={
                  showNotes ? "rotate" : ""
                }
              />
            </button>

            {showNotes && (
              <textarea
                value={form.notes}
                onChange={(event) =>
                  updateField(
                    "notes",
                    event.target.value
                  )
                }
                placeholder="Anything our team should know about this order?"
                rows={4}
              />
            )}

          </section>


          {/* =================================================
              CONTINUE
          ================================================= */}

          <div className="checkout-action">

            <button
              type="submit"
              className="checkout-submit"
              disabled={loading}
            >

              <span>

                {loading
                  ? "Preparing your order..."
                  : "Continue to payment"}

                <small>
                  Review everything before payment
                </small>

              </span>

              <span className="checkout-submit-arrow">

                {loading ? (
                  <span className="checkout-spinner" />
                ) : (
                  <ArrowRight size={20} />
                )}

              </span>

            </button>


            <div className="checkout-security-note">

              <LockKeyhole size={15} />

              <span>
                Your information is encrypted and handled
                securely by Dantown Electrical.
              </span>

            </div>

          </div>

        </form>


        {/* =================================================
            ORDER SUMMARY
        ================================================= */}

        <aside className="checkout-summary">

          <div className="checkout-summary-header">

            <div>

              <p className="checkout-eyebrow">
                YOUR ORDER
              </p>

              <h2>Order summary</h2>

            </div>

            <span>
              {cartItems.length}{" "}
              {cartItems.length === 1
                ? "item"
                : "items"}
            </span>

          </div>


          {/* PRODUCTS */}

          <div className="checkout-products">

            {cartItems.map((item) => (

              <div
                className="checkout-product"
                key={item.id}
              >

                <div className="checkout-product-image">

                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={72}
                      height={72}
                    />
                  ) : (
                    <div>
                      <Smartphone size={20} />
                    </div>
                  )}

                  <span>
                    {item.quantity}
                  </span>

                </div>

                <div className="checkout-product-info">

                  <strong>
                    {item.name}
                  </strong>

                  {item.brand && (
                    <small>
                      {item.brand}
                    </small>
                  )}

                  <span>
                    {formatCurrency(item.price)}
                  </span>

                </div>

              </div>

            ))}

          </div>


          {/* TOTALS */}

          <div className="checkout-totals">

            <div>
              <span>Subtotal</span>
              <strong>
                {formatCurrency(subtotal)}
              </strong>
            </div>

            <div>
              <span>
                {fulfilment === "delivery"
                  ? "Delivery"
                  : "Store pickup"}
              </span>

              <strong>
                {fulfilment === "delivery"
                  ? deliveryFee > 0
                    ? formatCurrency(deliveryFee)
                    : "To confirm"
                  : "Free"}
              </strong>
            </div>

            {discount > 0 && (
              <div className="discount-row">

                <span>Discount</span>

                <strong>
                  -
                  {formatCurrency(discount)}
                </strong>

              </div>
            )}

          </div>


          <div className="checkout-grand-total">

            <span>Total</span>

            <strong>
              {formatCurrency(total)}
            </strong>

            <small>
              Kenyan Shillings · KES
            </small>

          </div>


          {/* BENEFITS */}

          <div className="checkout-benefits">

            <div>
              <ShieldCheck size={17} />

              <span>
                <strong>Genuine products</strong>
                Electrical & solar products you can trust.
              </span>
            </div>

            <div>
              <MapPin size={17} />

              <span>
                <strong>Kitale based</strong>
                Local support and fulfilment.
              </span>
            </div>

            <div>
              <Truck size={17} />

              <span>
                <strong>Flexible fulfilment</strong>
                Pickup or delivery.
              </span>
            </div>

          </div>


          <Link
            href="/shop"
            className="checkout-shop-more"
          >
            Continue shopping
            <ArrowRight size={16} />
          </Link>

        </aside>

      </div>

    </main>
  );
}