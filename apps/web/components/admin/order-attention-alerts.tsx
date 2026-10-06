"use client";

import { useEffect, useState } from "react";

type AttentionOrder = {
  id: string;
  order_number: string;
  order_status: string;
  created_at: string;
  customer_name: string | null;
  total: number | null;
};

export function OrderAttentionAlerts() {
  const [orders, setOrders] = useState<AttentionOrder[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("just now");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      try {
        setRefreshing(true);
        const response = await fetch("/api/admin/order-attention", { cache: "no-store" });
        if (!response.ok) return;

        const payload = await response.json();
        if (!active) return;

        const nextOrders = Array.isArray(payload.orders) ? payload.orders : [];
        setOrders(nextOrders);
        setLastUpdated(new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }));
      } catch (error) {
        console.error("Failed to load order attention alerts", error);
      } finally {
        if (active) {
          setRefreshing(false);
        }
      }
    }

    loadOrders();
    const interval = window.setInterval(loadOrders, 30000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadOrders();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  if (!orders.length) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 22,
        top: 22,
        zIndex: 1200,
        display: "grid",
        gap: 10,
        width: 360,
        maxWidth: "calc(100vw - 24px)"
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      {orders.map((order) => (
        <div
          key={order.id}
          role="alert"
          style={{
            background: "#1f2937",
            color: "#f8fafc",
            borderLeft: "4px solid #f59e0b",
            borderRadius: 12,
            boxShadow: "0 16px 40px rgba(15, 23, 42, 0.28)",
            padding: "14px 16px",
            fontFamily: "system-ui, sans-serif"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <strong style={{ fontSize: 14, letterSpacing: 0.3 }}>New order needs attention</strong>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  const refresh = async () => {
                    const response = await fetch("/api/admin/order-attention", { cache: "no-store" });
                    if (!response.ok) return;
                    const payload = await response.json();
                    setOrders(Array.isArray(payload.orders) ? payload.orders : []);
                  };
                  void refresh();
                }}
                aria-label="Refresh alerts"
                title="Refresh alerts"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#f8fafc",
                  borderRadius: 999,
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: refreshing ? 0.5 : 1
                }}
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <button
                type="button"
                onClick={() => setOrders((current) => current.filter((entry) => entry.id !== order.id))}
                aria-label={`Dismiss alert for ${order.order_number}`}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#cbd5e1",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
            <div><strong>{order.order_number}</strong> · {order.order_status}</div>
            <div>{order.customer_name || "Guest customer"}</div>
            <div>{new Date(order.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</div>
            <div>{order.total ? `KSh ${Number(order.total).toLocaleString()}` : "Order total pending"}</div>
            <div style={{ marginTop: 6, color: "#fbbf24", fontSize: 11, fontWeight: 700 }}>
              Updated: {lastUpdated}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
