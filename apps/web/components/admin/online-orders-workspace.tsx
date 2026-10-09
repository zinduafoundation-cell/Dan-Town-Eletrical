"use client";

import { useMemo, useState } from "react";
import { MapPin, Package, Phone, ShoppingBag, Truck } from "lucide-react";
import { OrderManagementActions } from "@/components/order-management-actions";
import { OrderFulfillmentActions } from "@/components/admin/order-fulfillment-actions";

export type OnlineOrder = {
  id: string;
  orderNumber: string;
  salesChannel: "ONLINE" | "POS";
  customer: { name: string; phone: string | null; email: string | null } | null;
  subtotal: number;
  vat: number;
  deliveryFee: number;
  total: number;
  paymentStatus: string;
  orderStatus: string;
  fulfillmentType: "pickup" | "delivery";
  shippingAddress: { county: string; town: string; address: string } | null;
  deliveryMethod: string | null;
  deliveryCarrier: string | null;
  deliveryTrackingReference: string | null;
  deliveredAt: string | null;
  deliveryConfirmedAt: string | null;
  deliveryProofUrl: string | null;
  createdAt: string;
  items: Array<{ id: string; name: string; sku: string; quantity: number; unitPrice: number; lineTotal: number }>;
};

type OrderView = "all" | "ongoing" | "ready" | "delivered" | "cancelled";

const statusLabels: Record<string, string> = {
  PENDING: "Order received",
  PAYMENT_PENDING: "Payment pending",
  PAID: "Paid",
  PROCESSING: "Processing",
  READY_FOR_PICKUP: "Ready for pickup",
  READY_FOR_DELIVERY: "Ready for delivery",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
  FAILED: "Failed",
};

function matchesView(order: OnlineOrder, view: OrderView) {
  if (view === "all") return true;
  if (view === "ongoing") return ["PENDING", "PAYMENT_PENDING", "PAID", "PROCESSING"].includes(order.orderStatus);
  if (view === "ready") return ["READY_FOR_PICKUP", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY"].includes(order.orderStatus);
  if (view === "delivered") return order.orderStatus === "DELIVERED";
  return ["CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED", "FAILED"].includes(order.orderStatus);
}

function money(value: number) {
  return `KSh ${value.toLocaleString()}`;
}

export function OnlineOrdersWorkspace({ orders, isAdmin = false }: { orders: OnlineOrder[]; isAdmin?: boolean }) {
  const [view, setView] = useState<OrderView>("all");
  const [query, setQuery] = useState("");

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = matchesView(order, view);
      if (!matchesStatus) return false;
      if (!normalized) return true;

      const searchable = [order.orderNumber, order.customer?.name ?? "", order.customer?.phone ?? "", order.customer?.email ?? ""].join(" ");
      return searchable.toLowerCase().includes(normalized);
    });
  }, [orders, query, view]);

  const counts = useMemo(() => ({
    all: orders.length,
    ongoing: orders.filter((order) => matchesView(order, "ongoing")).length,
    ready: orders.filter((order) => matchesView(order, "ready")).length,
    delivered: orders.filter((order) => matchesView(order, "delivered")).length,
    cancelled: orders.filter((order) => matchesView(order, "cancelled")).length,
  }), [orders]);

  return (
    <div className="online-orders-workspace">
      <div className="online-orders-intro">
        <div>
          <p className="eyebrow">Customer orders</p>
          <h2>Track every order from receipt through delivery or pickup.</h2>
          <p>Customer details, transport, carrier, status, and delivery proof stay together for website and POS orders.</p>
        </div>
        <div className="online-orders-channel">
          <ShoppingBag size={18} />
          <span>ALL CHANNELS</span>
          <small>Online + POS</small>
        </div>
      </div>

      <div className="online-orders-toolbar">
        <label className="online-orders-search">
          <span className="sr-only">Search orders</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order number, customer, phone or email..." />
        </label>

        <div className="online-orders-tabs" role="tablist" aria-label="Order status">
          {(["all", "ongoing", "ready", "delivered", "cancelled"] as const).map((key) => (
            <button key={key} type="button" role="tab" aria-selected={view === key} className={view === key ? "is-active" : ""} onClick={() => setView(key)}>
              {key === "ready" ? "Ready / pickup" : key[0].toUpperCase() + key.slice(1)} <b>{counts[key]}</b>
            </button>
          ))}
        </div>
      </div>

      <div className="online-orders-list">
        {filteredOrders.length ? (
          filteredOrders.map((order) => <OnlineOrderCard key={order.id} order={order} isAdmin={isAdmin} />)
        ) : (
          <div className="online-orders-empty">
            <Package size={24} />
            <h3>No orders in this view.</h3>
            <p>Website and POS orders will appear here as soon as they are created.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function OnlineOrderCard({ order, isAdmin }: { order: OnlineOrder; isAdmin: boolean }) {
  const customerName = order.customer?.name || "Guest customer";
  const address = order.shippingAddress;

  return (
    <article className="online-order-card">
      <header className="online-order-card-header">
        <div>
          <p className="eyebrow">{order.orderNumber}</p>
          <h3>{customerName}</h3>
          <small>{new Date(order.createdAt).toLocaleString()}</small>
        </div>
        <div className="online-order-badges">
          <span className="online-order-fulfillment">{order.salesChannel}</span>
          <span className={`online-order-status status-${order.orderStatus.toLowerCase()}`}>{statusLabels[order.orderStatus] ?? order.orderStatus}</span>
          <span className="online-order-fulfillment"><Truck size={14} /> {order.fulfillmentType === "pickup" ? "Customer pickup" : "Delivery"}</span>
        </div>
      </header>

      <div className="online-order-card-grid">
        <section>
          <h4>Customer & destination</h4>
          <div className="online-order-details">
            {order.customer?.phone && <a href={`tel:${order.customer.phone}`}><Phone size={15} />{order.customer.phone}</a>}
            {order.customer?.email && <span>{order.customer.email}</span>}
            {order.fulfillmentType === "delivery" && (
              <span><MapPin size={15} />{[address?.address, address?.town, address?.county].filter(Boolean).join(", ") || "Address not provided"}</span>
            )}
            {order.fulfillmentType === "pickup" && <span><MapPin size={15} />Call customer when ready for collection</span>}
          </div>
        </section>

        <section>
          <h4>Items ({order.items.reduce((sum, item) => sum + item.quantity, 0)})</h4>
          <ul className="online-order-items">
            {order.items.map((item) => (
              <li key={item.id}>
                <span>
                  <strong>{item.quantity} × {item.name}</strong>
                  <small>{item.sku} · {money(item.unitPrice)} each</small>
                </span>
                <b>{money(item.lineTotal)}</b>
              </li>
            ))}
          </ul>
        </section>

        <section className="online-order-total">
          <h4>Order total</h4>
          <dl>
            <div><dt>Items</dt><dd>{money(order.subtotal)}</dd></div>
            <div><dt>VAT</dt><dd>{money(order.vat)}</dd></div>
            <div><dt>Delivery</dt><dd>{money(order.deliveryFee)}</dd></div>
            <div className="total"><dt>Total</dt><dd>{money(order.total)}</dd></div>
          </dl>
          <span className={`online-order-payment payment-${order.paymentStatus.toLowerCase()}`}>Payment : {order.paymentStatus}</span>
          <OrderFulfillmentActions
            orderId={order.id}
            orderStatus={order.orderStatus}
            fulfillmentType={order.fulfillmentType}
            deliveryMethod={order.deliveryMethod}
            carrier={order.deliveryCarrier}
            trackingReference={order.deliveryTrackingReference}
            isAdmin={isAdmin}
          />
          {order.deliveryConfirmedAt && (
            <p className="delivery-proof-recorded">
              Customer confirmed delivery on {new Date(order.deliveryConfirmedAt).toLocaleString("en-KE")}
              {order.deliveryProofUrl && <> · <a href={order.deliveryProofUrl} target="_blank" rel="noreferrer">View proof</a></>}
            </p>
          )}
          <OrderManagementActions orderId={order.id} orderStatus={order.orderStatus} createdAt={order.createdAt} isAdmin={isAdmin} />
        </section>
      </div>
    </article>
  );
}
