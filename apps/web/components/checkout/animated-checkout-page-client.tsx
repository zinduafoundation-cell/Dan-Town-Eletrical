"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Loader2, MapPin, Search, ShieldCheck, Truck } from "lucide-react";
import { useCart } from "@/components/cart/cart-context";
import { formatCurrency } from "@/lib/store-data";

type Fulfilment = "pickup" | "delivery";

type FormState = {
  fullName: string;
  phone: string;
  email: string;
  county: string;
  town: string;
  address: string;
};

type DeliveryEstimate = {
  source: "google" | "local-estimate";
  formattedAddress: string | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  deliveryFee: number;
  message: string;
};

const initialForm: FormState = {
  fullName: "",
  phone: "",
  email: "",
  county: "Trans Nzoia",
  town: "Kitale",
  address: ""
};

export function CheckoutPageClient() {
  const router = useRouter();
  const cart = useCart();
  const [form, setForm] = useState<FormState>(initialForm);
  const [fulfilment, setFulfilment] = useState<Fulfilment>("pickup");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [deliveryEstimate, setDeliveryEstimate] = useState<DeliveryEstimate | null>(null);
  const [error, setError] = useState("");
  const deliveryFee = fulfilment === "delivery" ? (deliveryEstimate?.deliveryFee ?? 250) : 0;
  const total = useMemo(() => cart.getSubtotal() + deliveryFee, [cart, deliveryFee]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/checkout/profile", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<Partial<FormState>>;
      })
      .then((profile) => {
        if (!cancelled && profile) setForm((current) => ({ ...current, ...profile }));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function estimateDelivery() {
    if (!form.address.trim() || !form.town.trim() || !form.county.trim()) {
      setError("Enter your county, town, and a landmark or delivery address first.");
      return;
    }
    setEstimating(true);
    setError("");
    try {
      const response = await fetch("/api/delivery/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ county: form.county, town: form.town, address: form.address })
      });
      const result = await response.json() as DeliveryEstimate & { error?: string };
      if (!response.ok) throw new Error(result.error || "We could not estimate that location.");
      setDeliveryEstimate(result);
    } catch (estimateError) {
      setError(estimateError instanceof Error ? estimateError.message : "We could not estimate that location.");
    } finally {
      setEstimating(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.items.length) return;
    if (!form.fullName.trim() || !form.phone.trim() || (fulfilment === "delivery" && !form.address.trim())) {
      setError("Complete your name, phone number, and delivery address before continuing.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const profileResponse = await fetch("/api/checkout/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!profileResponse.ok) {
        const payload = await profileResponse.json().catch(() => null);
        throw new Error(payload?.error || "Unable to save your details.");
      }

      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.fullName,
          phoneNumber: form.phone,
          email: form.email || null,
          fulfillmentType: fulfilment,
          shippingAddress: fulfilment === "delivery"
            ? { county: form.county, town: form.town, address: form.address, googleAddress: deliveryEstimate?.formattedAddress, distanceKm: deliveryEstimate?.distanceKm, durationMinutes: deliveryEstimate?.durationMinutes }
            : null,
          items: cart.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          subtotal: cart.getSubtotal(),
          deliveryFee,
          total
        })
      });
      const order = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(order.error || "Unable to start your order.");

      window.localStorage.setItem(
        "dantown-pending-payment",
        JSON.stringify({ orderId: order.orderId, orderNumber: order.orderNumber, total: order.total })
      );
      router.push(`/payment?orderId=${encodeURIComponent(order.orderId)}&orderNumber=${encodeURIComponent(order.orderNumber)}&total=${encodeURIComponent(order.total)}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to continue to payment.");
      setSaving(false);
    }
  }

  if (!cart.isHydrated || loadingProfile) {
    return <div className="empty-state"><Loader2 className="animate-spin" /> Loading your saved details…</div>;
  }

  if (!cart.items.length) {
    return (
      <div className="empty-state">
        <h2>Your cart is empty</h2>
        <Link href="/shop" className="button button-primary">Shop products <ArrowRight size={16} /></Link>
      </div>
    );
  }

  return (
    <form className="checkout-form" onSubmit={submit}>
      <div className="checkout-progress" aria-label="Checkout progress">
        <div className="checkout-step active"><span>1</span><strong>Details</strong></div>
        <div className="checkout-line active" />
        <div className="checkout-step"><span>2</span><strong>Payment</strong></div>
      </div>

      <section className="content-panel">
        <div className="section-heading">
          <div><p className="eyebrow">Saved for your next order</p><h2>Your details</h2></div>
          <ShieldCheck size={22} />
        </div>
        <p className="account-muted">These details were loaded from your account. You can change them for this purchase.</p>
        <div className="form-grid">
          {(["fullName", "phone", "email", "county", "town", "address"] as const).map((field) => (
            <label key={field} className={field === "address" ? "form-field full-width" : "form-field"}>
              <span>{field === "fullName" ? "Full name" : field === "phone" ? "Phone number" : field === "email" ? "Email" : field === "county" ? "County" : field === "town" ? "Town" : "Delivery address"}</span>
              <input
                type={field === "email" ? "email" : "text"}
                value={form[field]}
                onChange={(event) => update(field, event.target.value)}
                required={field === "fullName" || field === "phone" || (field === "address" && fulfilment === "delivery")}
                autoComplete={field === "fullName" ? "name" : field === "phone" ? "tel" : field === "email" ? "email" : "street-address"}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="content-panel">
        <div className="section-heading"><div><p className="eyebrow">Fulfilment</p><h2>How would you like it?</h2></div><MapPin size={22} /></div>
        <div className="payment-methods">
          <button type="button" className={`payment-method ${fulfilment === "pickup" ? "selected" : ""}`} onClick={() => setFulfilment("pickup")}><Truck size={20} /><span><strong>Pickup in Kitale</strong><small>Ready for collection</small></span>{fulfilment === "pickup" && <Check size={18} />}</button>
          <button type="button" className={`payment-method ${fulfilment === "delivery" ? "selected" : ""}`} onClick={() => setFulfilment("delivery")}><MapPin size={20} /><span><strong>Delivery</strong><small>{deliveryEstimate ? `From ${formatCurrency(deliveryEstimate.deliveryFee)}` : "Search your location for an estimate"}</small></span>{fulfilment === "delivery" && <Check size={18} />}</button>
        </div>
      </section>

      {fulfilment === "delivery" && (
        <section className="content-panel delivery-estimate-panel">
          <div className="section-heading">
            <div><p className="eyebrow">Google Maps estimate</p><h2>Find your delivery location</h2></div>
            <Search size={22} />
          </div>
          <p className="account-muted">Use a village, estate, building, street, or nearby landmark. Google helps us find smaller locations and estimate the route from Kitale.</p>
          <button type="button" className="button button-secondary delivery-estimate-button" onClick={estimateDelivery} disabled={estimating}>
            {estimating ? <><Loader2 className="animate-spin" size={16} /> Finding route…</> : <><Search size={16} /> Search location &amp; estimate delivery</>}
          </button>
          {deliveryEstimate && (
            <div className="delivery-estimate-result" role="status">
              <MapPin size={18} />
              <div>
                <strong>{deliveryEstimate.formattedAddress || `${form.address}, ${form.town}`}</strong>
                <p>{deliveryEstimate.distanceKm !== null ? `${deliveryEstimate.distanceKm} km away` : "Local delivery estimate"} {deliveryEstimate.durationMinutes !== null ? ` · about ${deliveryEstimate.durationMinutes} min travel` : ""}</p>
                <small>{deliveryEstimate.message}</small>
              </div>
              <b>{formatCurrency(deliveryEstimate.deliveryFee)}</b>
            </div>
          )}
        </section>
      )}

      {error && <p className="auth-error" role="alert">{error}</p>}

      <aside className="summary-panel">
        <div className="summary-row"><span>{cart.getTotalCount()} items</span><strong>{formatCurrency(cart.getSubtotal())}</strong></div>
        <div className="summary-row"><span>Delivery</span><strong>{formatCurrency(deliveryFee)}</strong></div>
        <div className="summary-row total"><span>Total</span><strong>{formatCurrency(total)}</strong></div>
        <button className="button button-primary" type="submit" disabled={saving}>{saving ? <><Loader2 className="animate-spin" size={16} /> Saving and continuing…</> : <>Continue to payment <ArrowRight size={16} /></>}</button>
        <p className="summary-note">Your payment method can be changed on the next step.</p>
      </aside>
    </form>
  );
}
