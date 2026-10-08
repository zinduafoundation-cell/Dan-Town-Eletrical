"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  DollarSign,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";

import { getOfflineQueueSummary } from "@/lib/pos/offline-queue";
import { summarizeOfflineQueue } from "@/lib/pos/queue-summary";
import "./pos-monitor.css";

type DashboardMetrics = {
  todaysSales: number;
  transactions: number;
  cashSales: number;
  mPesaSales: number;
  averageSale: number;
  pendingSync: number;
  lowStockCount: number;
  recentSales: Array<{
    id: string;
    orderNumber: string;
    total: number;
    createdAt: string;
  }>;
};

const EMPTY_METRICS: DashboardMetrics = {
  todaysSales: 0,
  transactions: 0,
  cashSales: 0,
  mPesaSales: 0,
  averageSale: 0,
  pendingSync: 0,
  lowStockCount: 0,
  recentSales: [],
};

const INITIAL_QUEUE = {
  PENDING: 0,
  SYNCING: 0,
  SYNCED: 0,
  FAILED: 0,
  CONFLICT: 0,
};

const money = (value: number) =>
  `KSh ${Number(value || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 2,
  })}`;

const number = (value: number) =>
  Number(value || 0).toLocaleString("en-KE");

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  accent,
  warning = false,
  index,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  detail: string;
  accent: string;
  warning?: boolean;
  index: number;
}) {
  return (
    <article
      className={`pm-metric pm-accent-${accent} ${
        warning ? "pm-metric-warning" : ""
      }`}
      style={{ animationDelay: `${index * 75}ms` }}
    >
      <div className="pm-metric-top">
        <span className="pm-metric-icon">
          <Icon size={21} strokeWidth={1.8} />
        </span>
        {warning ? (
          <span className="pm-alert-dot" title="Needs attention" />
        ) : (
          <ArrowUpRight className="pm-trend-icon" size={17} />
        )}
      </div>

      <p className="pm-metric-label">{label}</p>
      <div className="pm-metric-value">{value}</div>
      <p className="pm-metric-detail">{detail}</p>
      <span className="pm-metric-glow" aria-hidden="true" />
    </article>
  );
}

export function POSDashboard() {
  const [metrics, setMetrics] =
    useState<DashboardMetrics>(EMPTY_METRICS);

  const [queueSummary, setQueueSummary] = useState(() =>
    summarizeOfflineQueue(INITIAL_QUEUE)
  );

  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);

  const refreshQueue = useCallback(async () => {
    try {
      const summary = await getOfflineQueueSummary();
      const queue = summarizeOfflineQueue(summary);

      setQueueSummary(queue);

      setMetrics((current) => ({
        ...current,
        pendingSync:
          summary.PENDING +
          summary.SYNCING +
          summary.FAILED +
          summary.CONFLICT,
      }));
    } catch {
      // Keep the last known queue state if local storage is unavailable.
    }
  }, []);

  const fetchMetrics = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);

    try {
      const response = await fetch("/api/pos/dashboard", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Dashboard request failed: ${response.status}`);
      }

      const data = (await response.json()) as Partial<DashboardMetrics>;

      setMetrics((current) => ({
        ...current,
        ...data,
        // Local offline queue remains the source of truth for pending sync.
        pendingSync: current.pendingSync,
        recentSales: Array.isArray(data.recentSales)
          ? data.recentSales
          : current.recentSales,
      }));

      setApiError(false);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch POS dashboard metrics:", error);
      setApiError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    setClock(new Date());

    const updateOnline = () => setIsOnline(navigator.onLine);
    const updateClock = () => setClock(new Date());

    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);

    const clockInterval = window.setInterval(updateClock, 1000);
    const metricsInterval = window.setInterval(
      () => void fetchMetrics(),
      30000
    );

    const syncListener = () => void refreshQueue();

    window.addEventListener("dantown-pos-sync", syncListener);

    void fetchMetrics();
    void refreshQueue();

    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("dantown-pos-sync", syncListener);
      window.clearInterval(clockInterval);
      window.clearInterval(metricsInterval);
    };
  }, [fetchMetrics, refreshQueue]);

  const cards = [
    {
      icon: DollarSign,
      label: "Today's sales",
      value: money(metrics.todaysSales),
      detail: "Total recorded sales today",
      accent: "mint",
    },
    {
      icon: ShoppingCart,
      label: "Transactions",
      value: number(metrics.transactions),
      detail: "Recorded transactions today",
      accent: "blue",
    },
    {
      icon: TrendingUp,
      label: "Cash sales",
      value: money(metrics.cashSales),
      detail: "Paid through cash",
      accent: "amber",
    },
    {
      icon: Zap,
      label: "M-Pesa sales",
      value: money(metrics.mPesaSales),
      detail: "Recorded M-Pesa sales",
      accent: "violet",
    },
    {
      icon: Activity,
      label: "Average sale",
      value: money(metrics.averageSale),
      detail: "Average value per sale",
      accent: "cyan",
    },
    {
      icon: RefreshCw,
      label: "Pending sync",
      value: number(metrics.pendingSync),
      detail:
        metrics.pendingSync > 0
          ? "Transactions need attention"
          : "No queued transactions",
      accent: "orange",
      warning: metrics.pendingSync > 0,
    },
    {
      icon: Package,
      label: "Low stock",
      value: number(metrics.lowStockCount),
      detail:
        metrics.lowStockCount > 0
          ? "Products need restocking"
          : "No low-stock alerts reported",
      accent: "rose",
      warning: metrics.lowStockCount > 0,
    },
  ];

  const actions = [
    {
      href: "/pos/new-sale",
      icon: Plus,
      title: "New sale",
      description: "Start a transaction",
      primary: true,
    },
    {
      href: "/pos/sales-history",
      icon: ShoppingCart,
      title: "Sales history",
      description: "Review transactions",
    },
    {
      href: "/pos/customers",
      icon: Users,
      title: "Customers",
      description: "Customer records",
    },
    {
      href: "/pos/inventory",
      icon: Package,
      title: "Inventory",
      description: "Stock and products",
    },
    {
      href: "/pos/reports",
      icon: TrendingUp,
      title: "Reports",
      description: "Business performance",
    },
  ];

  const formattedTime = clock
    ? clock.toLocaleTimeString("en-KE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "--:--:--";

  return (
    <main className="pos-dashboard pm-monitor">
      <div className="pm-atmosphere" aria-hidden="true">
        <span className="pm-orb pm-orb-one" />
        <span className="pm-orb pm-orb-two" />
        <span className="pm-orb pm-orb-three" />
        <span className="pm-grid" />
      </div>

      <div className="pm-content">
        <header className="pm-header">
          <div className="pm-heading">
            <div className="pm-eyebrow">
              <span className="pm-live-dot" />
              DANTOWN ELECTRICAL
              <span className="pm-eyebrow-divider">/</span>
              POS CONTROL CENTER
            </div>

            <h1>
              POS <span>Monitor</span>
            </h1>

            <p>
              Your sales floor at a glance. Monitor performance,
              transactions and operations in one place.
            </p>
          </div>

          <div className="pm-header-controls">
            <div
              className={`pm-connection ${
                isOnline ? "is-online" : "is-offline"
              }`}
            >
              {isOnline ? (
                <Wifi size={16} />
              ) : (
                <WifiOff size={16} />
              )}
              <span>{isOnline ? "Network online" : "Network offline"}</span>
            </div>

            <button
              type="button"
              className="pm-refresh-button"
              onClick={() => {
                void fetchMetrics(true);
                void refreshQueue();
              }}
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={refreshing ? "pm-spin" : ""}
              />
              <span>{refreshing ? "Refreshing" : "Refresh"}</span>
            </button>
          </div>
        </header>

        <section className="pm-status-strip" aria-label="POS status">
          <div className="pm-status-main">
            <span className="pm-status-icon">
              <Activity size={19} />
            </span>
            <div>
              <strong>Operations board</strong>
              <span>Local system time · {formattedTime}</span>
            </div>
          </div>

          <div className="pm-status-items">
            <div className="pm-status-item">
              <span className="pm-status-indicator pm-green" />
              <span>Sales recorded</span>
              <strong>{number(metrics.transactions)}</strong>
            </div>

            <div className="pm-status-item">
              <span
                className={`pm-status-indicator ${
                  metrics.pendingSync > 0 ? "pm-orange" : "pm-green"
                }`}
              />
              <span>Waiting to sync</span>
              <strong>{number(metrics.pendingSync)}</strong>
            </div>

            <div className="pm-status-item">
              <ShieldCheck size={15} />
              <span>POS workspace</span>
              <strong>Active</strong>
            </div>
          </div>
        </section>

        {apiError && (
          <div className="pm-error-banner" role="status">
            <AlertCircle size={18} />
            <div>
              <strong>Dashboard data could not be refreshed</strong>
              <span>
                Showing the last available figures. Check your connection
                and dashboard API.
              </span>
            </div>
            <button type="button" onClick={() => void fetchMetrics(true)}>
              Try again
            </button>
          </div>
        )}

        <section className="pm-section">
          <div className="pm-section-heading">
            <div>
              <span className="pm-section-kicker">PERFORMANCE</span>
              <h2>Today is overview</h2>
            </div>
            <span className="pm-updated">
              <Clock3 size={14} />
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString("en-KE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Waiting for data"}
            </span>
          </div>

          <div className="pm-metrics-grid">
            {cards.map((card, index) => (
              <MetricCard
                key={card.label}
                {...card}
                index={index}
              />
            ))}
          </div>
        </section>

        <section className="pm-section">
          <div className="pm-section-heading">
            <div>
              <span className="pm-section-kicker">WORKSPACE</span>
              <h2>Quick actions</h2>
            </div>
            <span className="pm-subtle-label">
              <Zap size={14} />
              Ready when you are
            </span>
          </div>

          <div className="pm-actions-grid">
            {actions.map((action) => {
              const Icon = action.icon;

              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`pm-action ${
                    action.primary ? "pm-action-primary" : ""
                  }`}
                >
                  <span className="pm-action-icon">
                    <Icon size={21} />
                  </span>
                  <span className="pm-action-copy">
                    <strong>{action.title}</strong>
                    <small>{action.description}</small>
                  </span>
                  <ArrowUpRight className="pm-action-arrow" size={17} />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="pm-section">
          <div className="pm-section-heading">
            <div>
              <span className="pm-section-kicker">RELIABILITY</span>
              <h2>Offline sync monitor</h2>
            </div>
            {metrics.pendingSync === 0 ? (
              <span className="pm-health-pill pm-health-good">
                <CheckCircle2 size={14} />
                Queue clear
              </span>
            ) : (
              <span className="pm-health-pill pm-health-warning">
                <AlertCircle size={14} />
                Action needed
              </span>
            )}
          </div>

          <div className={`pm-sync-panel pm-sync-${queueSummary.tone}`}>
            <div className="pm-sync-icon">
              {metrics.pendingSync === 0 ? (
                <CheckCircle2 size={23} />
              ) : (
                <RefreshCw size={23} />
              )}
            </div>
            <div className="pm-sync-copy">
              <strong>{queueSummary.headline}</strong>
              <p>
                {queueSummary.details.filter(Boolean).join(" · ") ||
                  "Your local queue status is being monitored."}
              </p>
            </div>
            <button
              type="button"
              className="pm-text-button"
              onClick={() => void refreshQueue()}
            >
              Check queue <ArrowUpRight size={15} />
            </button>
          </div>
        </section>

        <section className="pm-section pm-recent-section">
          <div className="pm-section-heading">
            <div>
              <span className="pm-section-kicker">TRANSACTION FEED</span>
              <h2>Recent sales</h2>
            </div>
            <Link href="/pos/sales-history" className="pm-view-all">
              View history <ArrowUpRight size={15} />
            </Link>
          </div>

          <div className="pm-sales-panel">
            {metrics.recentSales.length > 0 ? (
              <div className="pm-sales-list">
                {metrics.recentSales.map((sale, index) => (
                  <div
                    className="pm-sale-row"
                    key={sale.id}
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    <span className="pm-sale-icon">
                      <ShoppingCart size={18} />
                    </span>

                    <div className="pm-sale-info">
                      <strong>{sale.orderNumber}</strong>
                      <span>
                        {new Date(sale.createdAt).toLocaleString("en-KE", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="pm-sale-amount">
                      <strong>{money(sale.total)}</strong>
                      <span>
                        <CheckCircle2 size={12} /> Recorded
                      </span>
                    </div>

                    <ArrowDownRight
                      className="pm-sale-arrow"
                      size={17}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="pm-empty-state">
                <span className="pm-empty-icon">
                  <ShoppingCart size={25} />
                </span>
                <strong>No sales to display yet</strong>
                <p>
                  Once sales are recorded today, your latest transactions
                  will appear here.
                </p>
                <Link href="/pos/new-sale" className="pm-empty-action">
                  <Plus size={16} /> Start a new sale
                </Link>
              </div>
            )}
          </div>
        </section>

        <footer className="pm-footer">
          <span>
            <span className="pm-live-dot" />
            Dantown POS Monitor
          </span>
          <span>Built for clarity. Designed for speed.</span>
        </footer>
      </div>
    </main>
  );
}