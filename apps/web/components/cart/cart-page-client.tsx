"use client";

import Link from "next/link";
import { Headphones, Minus, Plus, ShieldCheck, ShoppingBag, Trash2, Truck } from "lucide-react";
import { formatCurrency } from "@/lib/store-data";
import { useCart } from "./cart-context";

export function CartPageClient() {
  const cart = useCart();

  if (!cart.isHydrated) {
    return (
      <section className="page-shell">
        <div className="page-hero compact">
          <p className="eyebrow">Cart</p>
          <h1>Loading your cart...</h1>
        </div>
      </section>
    );
  }

  if (cart.items.length === 0) {
    return (
      <section className="page-shell">
        <div className="page-hero compact">
          <p className="eyebrow">Cart</p>
          <h1>Your cart is empty</h1>
        </div>
        <div className="empty-state cart-empty-state">
          <h3>No items yet</h3>
          <p>Start shopping to add items to your cart.</p>
          <Link href="/shop" className="button button-primary">Continue shopping</Link>
        </div>
      </section>
    );
  }

  const subtotal = cart.getSubtotal();
  const total = cart.getTotal();

  return (
    <section className="page-shell">
      <div className="page-hero compact">
        <p className="eyebrow"><ShoppingBag size={16} /> Cart · {cart.getTotalCount()} {cart.getTotalCount() === 1 ? "item" : "items"}</p>
        <h1>Your selected items</h1>
        <p>Review your products, adjust quantities, and continue when you are ready. Your cart is saved while you shop.</p>
      </div>

      <div className="cart-layout">
        <div className="cart-items">
          {cart.items.map((item) => (
            <div className="cart-item" key={item.productId}>
              <div
                className="mini-art"
                style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                aria-hidden="true"
              />
              <div className="cart-item-info">
                <Link href={`/products/${item.slug}`}><h3>{item.name}</h3></Link>
                <p className="cart-item-sku">SKU: {item.sku}</p>
                <p className="cart-item-unit-price">{item.quantity} × {formatCurrency(item.unitPrice)}</p>
              </div>
              <div className="cart-item-quantity">
                <button type="button" onClick={() => cart.updateQuantity(item.productId, item.quantity - 1)} className="quantity-button" aria-label="Decrease quantity"><Minus size={16} /></button>
                <span className="quantity-display">{item.quantity}</span>
                <button type="button" onClick={() => cart.updateQuantity(item.productId, item.quantity + 1)} className="quantity-button" aria-label="Increase quantity"><Plus size={16} /></button>
              </div>
              <strong className="cart-item-total">{formatCurrency(item.unitPrice * item.quantity)}</strong>
              <button type="button" onClick={() => cart.removeItem(item.productId)} className="remove-button" aria-label={`Remove ${item.name}`}>
                <Trash2 size={18} /><span>Remove</span>
              </button>
            </div>
          ))}
        </div>

        <aside className="summary-panel">
          <div className="summary-heading"><div><p className="eyebrow">Ready when you are</p><h3>Order summary</h3></div><ShieldCheck size={22} aria-hidden="true" /></div>
          <div className="summary-row"><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
          <div className="summary-row"><span>Delivery</span><strong>KES 0</strong></div>
          <div className="summary-row total"><span>Total</span><strong>{formatCurrency(total)}</strong></div>
          <Link className="button button-primary" href="/checkout">Proceed to checkout</Link>
          <Link className="button button-secondary" href="/shop">Continue shopping</Link>
          <p className="summary-note"><ShieldCheck size={15} /> Secure checkout · Genuine products · Human support</p>
        </aside>
      </div>

      <div className="cart-benefits" aria-label="Shopping benefits">
        <div><Truck size={20} /><span><strong>Flexible fulfilment</strong><small>Pickup in Kitale or delivery</small></span></div>
        <div><ShieldCheck size={20} /><span><strong>Genuine products</strong><small>Trusted electrical brands</small></span></div>
        <div><Headphones size={20} /><span><strong>Expert support</strong><small>We are here when you need us</small></span></div>
      </div>
    </section>
  );
}
