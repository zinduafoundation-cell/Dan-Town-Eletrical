import { notFound } from "next/navigation";
import {
  Banknote,
  CreditCard,
  Coins,
  Monitor,
  Smartphone,
  Wallet
} from "lucide-react";
import { requireAuthorizedPermission } from "../../../lib/auth/server";
import { createSupabaseServiceClient } from "../../../lib/supabase/server";
import { RefundSaleButton } from "@/components/pos/refund-sale-button";

const sections = {
  "sales-history": { title: "Sales History", description: "Review completed sales and payment status.", permission: "orders.read" as const },
  customers: { title: "Customers", description: "Find customer records and purchase context.", permission: "customers.read" as const },
  inventory: { title: "Inventory", description: "Monitor available stock and reorder thresholds.", permission: "inventory.read" as const },
  cash: { title: "Cash Management", description: "Track today’s tender totals and cash position.", permission: "orders.read" as const },
  reports: { title: "Reports", description: "Review today’s operating performance.", permission: "reports.read" as const },
  settings: { title: "POS Settings", description: "Review this register’s operating configuration.", permission: "orders.read" as const }
};

export const dynamic = "force-dynamic";

type Tone = "good" | "warn" | "bad" | "info";

function statusTone(value: string | null | undefined): Tone {
  const v = (value ?? "").toUpperCase();
  if (["PAID", "SUCCESS", "COMPLETED", "DELIVERED", "ACTIVE", "FULFILLED"].includes(v)) return "good";
  if (["FAILED", "CANCELLED", "CANCELED", "REFUNDED", "VOID", "INACTIVE"].includes(v)) return "bad";
  if (["PENDING", "PROCESSING", "PARTIAL", "ON_HOLD"].includes(v)) return "warn";
  return "info";
}

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`pos-badge pos-badge-${tone}`}>{children}</span>;
}

function money(value: number) {
  return `KSh ${Math.round(value).toLocaleString()}`;
}

function formatWhen(value: string | null | undefined) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function tenderIcon(method: string) {
  const m = method.toUpperCase();
  if (m.includes("CASH")) return <Banknote size={22} />;
  if (m.includes("MPESA") || m.includes("M-PESA")) return <Smartphone size={22} />;
  if (m.includes("CARD") || m.includes("PAYSTACK")) return <CreditCard size={22} />;
  return <Wallet size={22} />;
}

export default async function POSSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const config = sections[section as keyof typeof sections];
  if (!config) notFound();
  const context = await requireAuthorizedPermission(config.permission);
  const supabase = createSupabaseServiceClient();

  if (section === "customers") {
    const { data } = await supabase.from("customers").select("id, name, phone, email, customer_type, status").order("name").limit(100);
    return (
      <POSDataPage title={config.title} description={config.description}>
        {data?.length ? (
          <div className="pos-card-grid">
            {data.map((customer) => (
              <div className="pos-customer-card" key={customer.id}>
                <span className="pos-avatar" aria-hidden="true">{(customer.name || "?").trim().charAt(0).toUpperCase()}</span>
                <div className="pos-customer-info">
                  <strong>{customer.name}</strong>
                  <span>{customer.phone || customer.email || "No contact"}</span>
                </div>
                <div className="pos-customer-tags">
                  <Badge tone="info">{customer.customer_type}</Badge>
                  {customer.status && customer.status !== "ACTIVE" ? <Badge tone={statusTone(customer.status)}>{customer.status}</Badge> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="pos-empty">No customers found.</p>
        )}
      </POSDataPage>
    );
  }

  if (section === "inventory") {
    const { data } = await supabase.from("inventory").select("id, quantity, reserved_quantity, reorder_level, products(name, sku)").order("quantity").limit(100);
    return (
      <POSDataPage title={config.title} description={config.description}>
        {data?.length ? (
          <div className="pos-stock-list">
            {data.map((row) => {
              const product = Array.isArray(row.products) ? row.products[0] : row.products;
              const available = Number(row.quantity || 0) - Number(row.reserved_quantity || 0);
              const reorder = Number(row.reorder_level || 0);
              const state: "out" | "low" | "ok" = available <= 0 ? "out" : available <= reorder ? "low" : "ok";
              const target = Math.max(reorder * 3, available, 1);
              const fill = Math.max(4, Math.min(100, Math.round((Math.max(available, 0) / target) * 100)));
              return (
                <div className={`pos-stock-row pos-stock-${state}`} key={row.id}>
                  <div className="pos-stock-main">
                    <strong>{product?.name || "Product"}</strong>
                    <small>{product?.sku || ""}</small>
                  </div>
                  <div className="pos-stock-meter" aria-hidden="true"><span style={{ width: `${fill}%` }} /></div>
                  <div className="pos-stock-numbers">
                    <b>{available} available</b>
                    <small>reorder at {row.reorder_level}</small>
                  </div>
                  <Badge tone={state === "ok" ? "good" : state === "low" ? "warn" : "bad"}>
                    {state === "ok" ? "In stock" : state === "low" ? "Low stock" : "Out of stock"}
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="pos-empty">No inventory found.</p>
        )}
      </POSDataPage>
    );
  }

  if (section === "settings") {
    return (
      <POSDataPage title={config.title} description={config.description}>
        <div className="pos-card-grid pos-setting-grid">
          <div className="pos-setting-card">
            <span className="pos-setting-icon"><Monitor size={22} /></span>
            <strong>Register mode</strong>
            <span>Online with offline sale queue enabled</span>
          </div>
          <div className="pos-setting-card">
            <span className="pos-setting-icon"><Coins size={22} /></span>
            <strong>Receipt currency</strong>
            <span>Kenyan Shilling (KSh)</span>
          </div>
          <div className="pos-setting-card">
            <span className="pos-setting-icon"><Wallet size={22} /></span>
            <strong>Supported tenders</strong>
            <div className="pos-chip-row">
              {["Cash", "Card", "M-Pesa", "Paystack"].map((tender) => (
                <span className="pos-chip" key={tender}>{tender}</span>
              ))}
            </div>
          </div>
        </div>
      </POSDataPage>
    );
  }

  if (section === "cash") {
    const { data: payments } = await supabase.from("payments").select("amount, method, status").eq("status", "SUCCESS").gte("created_at", new Date().toISOString().slice(0, 10));
    const totals = (payments ?? []).reduce<Record<string, number>>((summary, payment) => {
      summary[payment.method] = (summary[payment.method] ?? 0) + Number(payment.amount || 0);
      return summary;
    }, {});
    const entries = Object.entries(totals);
    const grand = entries.reduce((sum, [, total]) => sum + total, 0);
    return (
      <POSDataPage title={config.title} description={config.description}>
        {entries.length ? (
          <>
            <div className="pos-total-banner">
              <span>Total</span>
              <strong>{money(grand)}</strong>
            </div>
            <div className="pos-card-grid">
              {entries.map(([method, total]) => (
                <div className="pos-tender-card" key={method}>
                  <span className="pos-tender-icon">{tenderIcon(method)}</span>
                  <div>
                    <strong>{method}</strong>
                    <span>{money(total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="pos-empty">No successful payments recorded today.</p>
        )}
      </POSDataPage>
    );
  }

  const { data: orders } = await supabase.from("orders").select("id, order_number, total, payment_status, order_status, created_at").order("created_at", { ascending: false }).limit(100);
  const list = orders ?? [];
  const canRefund = section === "sales-history" && context.permissions.includes("refunds.request");
  const salesTotal = list.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const paidCount = list.filter((order) => statusTone(order.payment_status) === "good").length;

  return (
    <POSDataPage title={config.title} description={config.description}>
      {list.length ? (
        <>
          {section === "reports" ? (
            <div className="pos-stat-row">
              <div className="pos-stat-card"><small>Total sales</small><strong>{money(salesTotal)}</strong></div>
              <div className="pos-stat-card"><small>Orders</small><strong>{list.length}</strong></div>
              <div className="pos-stat-card"><small>Paid</small><strong>{paidCount}</strong></div>
            </div>
          ) : null}
          <div className="pos-sale-list">
            {list.map((order) => (
              <div className="pos-sale-row" key={order.id}>
                <div className="pos-sale-main">
                  <strong>{order.order_number}</strong>
                  <small>{formatWhen(order.created_at)}</small>
                </div>
                <div className="pos-sale-amount">{money(Number(order.total))}</div>
                <div className="pos-sale-status">
                  <Badge tone={statusTone(order.payment_status)}>{order.payment_status}</Badge>
                  <Badge tone={statusTone(order.order_status)}>{order.order_status}</Badge>
                </div>
                {canRefund ? (
                  <div className="pos-sale-action">
                    <RefundSaleButton orderId={order.id} orderNumber={order.order_number} total={Number(order.total)} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="pos-empty">No sales recorded yet.</p>
      )}
    </POSDataPage>
  );
}

function POSDataPage({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="pos-data-page">
      <div className="pos-dashboard-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <section className="pos-dashboard-section">{children}</section>
    </div>
  );
}