"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, ShoppingCart, DollarSign, AlertCircle, Users, Package } from "lucide-react";
import { getOfflineQueueSummary } from "@/lib/pos/offline-queue";

type DashboardMetrics = {
  todaysSales: number;
  transactions: number;
  cashSales: number;
  mPesaSales: number;
  averageSale: number;
  pendingSync: number;
  lowStockCount: number;
  recentSales: Array<{ id: string; orderNumber: string; total: number; createdAt: string }>;
};

export function POSDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    todaysSales: 0,
    transactions: 0,
    cashSales: 0,
    mPesaSales: 0,
    averageSale: 0,
    pendingSync: 0,
    lowStockCount: 0,
    recentSales: []
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Fetch from /api/pos/dashboard or similar
        const response = await fetch("/api/pos/dashboard", {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        }).catch(() => null);

        if (response?.ok) {
          const data = await response.json();
          setMetrics((current) => ({ ...data, pendingSync: current.pendingSync }));
        }
      } catch (err) {
        console.error("Failed to fetch dashboard metrics:", err);
      } finally {
      }
    };

    fetchMetrics();
    const refreshQueue = () => {
      getOfflineQueueSummary().then((summary) => {
        setMetrics((current) => ({
          ...current,
          pendingSync: summary.PENDING + summary.SYNCING + summary.FAILED + summary.CONFLICT
        }));
      }).catch(() => undefined);
    };
    refreshQueue();
    window.addEventListener("dantown-pos-sync", refreshQueue);
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
    return () => {
      clearInterval(interval);
      window.removeEventListener("dantown-pos-sync", refreshQueue);
    };
  }, []);

  const cards = [
    {
      icon: DollarSign,
      label: "Today's Sales",
      value: `KSh ${metrics.todaysSales.toLocaleString()}`,
      color: "teal"
    },
    {
      icon: ShoppingCart,
      label: "Transactions",
      value: String(metrics.transactions),
      color: "lime"
    },
    {
      icon: TrendingUp,
      label: "Cash Sales",
      value: `KSh ${metrics.cashSales.toLocaleString()}`,
      color: "yellow"
    },
    {
      icon: TrendingUp,
      label: "M-Pesa Sales",
      value: `KSh ${metrics.mPesaSales.toLocaleString()}`,
      color: "coral"
    },
    {
      icon: DollarSign,
      label: "Average Sale",
      value: `KSh ${metrics.averageSale.toLocaleString()}`,
      color: "green"
    },
    {
      icon: AlertCircle,
      label: "Pending Sync",
      value: String(metrics.pendingSync),
      color: "orange",
      highlight: metrics.pendingSync > 0
    },
    {
      icon: AlertCircle,
      label: "Low Stock",
      value: String(metrics.lowStockCount),
      color: "orange",
      highlight: metrics.lowStockCount > 0
    }
  ];

  return (
    <div className="pos-dashboard">
      <div className="pos-dashboard-header">
        <h1>Dashboard</h1>
        <p>Today&apos;s performance at a glance</p>
      </div>

      {/* Metric Cards */}
      <div className="pos-metrics-grid">
        {cards.map((card, idx) => (
          <div
            key={idx}
            className={`pos-metric-card pos-metric-${card.color} ${card.highlight ? "highlight" : ""}`}
          >
            <div className="pos-metric-icon">
              <card.icon size={24} />
            </div>
            <div className="pos-metric-content">
              <div className="pos-metric-label">{card.label}</div>
              <div className="pos-metric-value">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="pos-dashboard-section">
        <h2>Quick Actions</h2>
        <div className="pos-quick-actions">
          <Link href="/pos/new-sale" className="pos-quick-action-button primary">
            <Plus size={20} />
            New Sale
          </Link>
          <Link href="/pos/sales-history" className="pos-quick-action-button secondary"><ShoppingCart size={18} /> Sales History</Link>
          <Link href="/pos/customers" className="pos-quick-action-button secondary"><Users size={18} /> Customers</Link>
          <Link href="/pos/inventory" className="pos-quick-action-button secondary"><Package size={18} /> Inventory</Link>
          <Link href="/pos/reports" className="pos-quick-action-button secondary"><TrendingUp size={18} /> Reports</Link>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="pos-dashboard-section">
        <h2>Recent Sales</h2>
        <div className="pos-recent-sales">
          {metrics.recentSales.length > 0 ? metrics.recentSales.map((sale) => (
            <div className="pos-data-row" key={sale.id}>
              <strong>{sale.orderNumber}</strong>
              <span>KSh {sale.total.toLocaleString()} · {new Date(sale.createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          )) : <p style={{ textAlign: "center", color: "#999", padding: "2rem" }}>No sales yet today. Start a new sale to see activity here.</p>}
        </div>
      </div>
    </div>
  );
}

function Plus({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
