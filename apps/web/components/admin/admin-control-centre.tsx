import Link from "next/link";
import { ArrowUpRight, Boxes, Building2, ClipboardList, CloudUpload, Cog, DollarSign, Package, RefreshCw, SearchCheck, ShoppingCart, Truck, Warehouse, Zap } from "lucide-react";

type CentreSummary = {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  productsAwaitingReview: number;
  totalStock: number;
  inventoryValue: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  suppliers: number;
  warehouses: number;
  recentPurchases: number;
  recentMovements: number;
  missingPrices: number;
  missingImages: number;
  missingCategories: number;
  unpublishedProducts: number;
  posUnavailable: number;
  syncPending: number;
  syncFailed: number;
  automationActive: number;
};

type CentreAction = {
  label: string;
  description: string;
  href: string;
  icon: typeof Package;
  permission?: string;
};

const actions: CentreAction[] = [
  { label: "Stock & inventory", description: "Quantities, reservations, movements, and adjustments.", href: "/admin/inventory", icon: Boxes, permission: "inventory.read" },
  { label: "Products", description: "Catalog records, pricing, publishing, and POS visibility.", href: "/admin/catalog", icon: Package, permission: "products.read" },
  { label: "Suppliers", description: "Supplier relationships and procurement context.", href: "/admin/suppliers", icon: Truck, permission: "products.read" },
  { label: "Purchases", description: "Purchase orders and receiving status.", href: "/admin/purchases", icon: ShoppingCart, permission: "inventory.read" },
  { label: "Import products", description: "Bring supplier data into the review pipeline.", href: "/admin/automation/inbox", icon: CloudUpload, permission: "automation.read" },
  { label: "Review inbox", description: "Resolve matches, missing data, and failed imports.", href: "/admin/automation/inbox", icon: SearchCheck, permission: "automation.read" },
  { label: "Price management", description: "Pricing rules, recommendations, and approvals.", href: "/admin/automation/pricing", icon: DollarSign, permission: "pricing.read" },
  { label: "Warehouses", description: "Branches, locations, and shared stock ownership.", href: "/admin/warehouses", icon: Warehouse, permission: "inventory.read" },
  { label: "Website catalogue", description: "See and manage the public product catalogue.", href: "/shop", icon: Building2, permission: "products.read" },
  { label: "POS control", description: "Available products, sales, and offline status.", href: "/pos", icon: ClipboardList, permission: "orders.read" },
  { label: "Sync monitor", description: "Offline POS sync records and exceptions.", href: "/admin/automation/history", icon: RefreshCw, permission: "orders.read" },
  { label: "Automation / n8n", description: "Workflow activity, errors, and review queues.", href: "/admin/automation", icon: Zap, permission: "automation.read" },
  { label: "Settings", description: "Platform and operating controls.", href: "/admin/settings", icon: Cog, permission: "users.read" }
];

function Metric({ label, value, detail, tone = "default" }: { label: string; value: string; detail?: string; tone?: "default" | "warning" | "critical" }) {
  return <article className={`centre-metric centre-metric-${tone}`}><small>{label}</small><strong>{value}</strong>{detail ? <span>{detail}</span> : null}</article>;
}

export function AdminControlCentre({ summary, permissions }: { summary: CentreSummary; permissions: string[] }) {
  const visibleActions = actions.filter((action) => !action.permission || permissions.includes(action.permission));

  return <div className="centre-dashboard">
    <section className="centre-summary-grid" aria-label="Business summary">
      <Metric label="Total products" value={summary.totalProducts.toLocaleString()} detail={`${summary.activeProducts.toLocaleString()} active · ${summary.draftProducts.toLocaleString()} draft`} />
      <Metric label="Stock quantity" value={summary.totalStock.toLocaleString()} detail={`KSh ${summary.inventoryValue.toLocaleString()} inventory value`} />
      <Metric label="Suppliers" value={summary.suppliers.toLocaleString()} detail={`${summary.warehouses.toLocaleString()} warehouses`} />
      <Metric label="Awaiting review" value={summary.productsAwaitingReview.toLocaleString()} tone={summary.productsAwaitingReview ? "warning" : "default"} detail="Product imports and matches" />
      <Metric label="Low stock" value={summary.lowStockProducts.toLocaleString()} tone={summary.lowStockProducts ? "warning" : "default"} detail={`${summary.outOfStockProducts.toLocaleString()} out of stock`} />
      <Metric label="Sync exceptions" value={(summary.syncPending + summary.syncFailed).toLocaleString()} tone={summary.syncFailed ? "critical" : summary.syncPending ? "warning" : "default"} detail={`${summary.syncPending} pending · ${summary.syncFailed} failed`} />
    </section>

    <section className="centre-data-strip" aria-label="Data quality summary">
      <div><span>Missing prices</span><strong>{summary.missingPrices}</strong></div>
      <div><span>Missing images</span><strong>{summary.missingImages}</strong></div>
      <div><span>Missing categories</span><strong>{summary.missingCategories}</strong></div>
      <div><span>Not published</span><strong>{summary.unpublishedProducts}</strong></div>
      <div><span>POS unavailable</span><strong>{summary.posUnavailable}</strong></div>
      <div><span>Recent movements</span><strong>{summary.recentMovements}</strong></div>
      <div><span>Recent purchases</span><strong>{summary.recentPurchases}</strong></div>
    </section>

    <section className="centre-attention" aria-labelledby="centre-attention-heading">
      <div><p className="eyebrow">Needs attention</p><h2 id="centre-attention-heading">Clear the next important tasks.</h2></div>
      <div className="centre-attention-list">
        {summary.productsAwaitingReview > 0 && <Link href="/admin/automation/inbox"><strong>{summary.productsAwaitingReview}</strong><span>product reviews waiting</span><ArrowUpRight size={15} /></Link>}
        {summary.lowStockProducts > 0 && <Link href="/admin/inventory"><strong>{summary.lowStockProducts}</strong><span>low-stock lines to inspect</span><ArrowUpRight size={15} /></Link>}
        {summary.syncFailed > 0 && <Link href="/admin/automation/history"><strong>{summary.syncFailed}</strong><span>sync exceptions to resolve</span><ArrowUpRight size={15} /></Link>}
        {summary.productsAwaitingReview === 0 && summary.lowStockProducts === 0 && summary.syncFailed === 0 && <p className="centre-attention-clear">No urgent exceptions are reported by the current data.</p>}
      </div>
    </section>

    <div className="centre-section-heading"><div><p className="eyebrow">Control centre</p><h2>Move the business forward.</h2></div><span>{summary.automationActive} active automation jobs</span></div>
    <section className="centre-action-grid" aria-label="Business workspaces">
      {visibleActions.map((action) => { const Icon = action.icon; return <Link className="centre-action-card" href={action.href} key={action.href + action.label}><span className="centre-action-icon"><Icon size={20} /></span><span><strong>{action.label}</strong><small>{action.description}</small></span><ArrowUpRight size={17} /></Link>; })}
    </section>
  </div>;
}

export type { CentreSummary };
