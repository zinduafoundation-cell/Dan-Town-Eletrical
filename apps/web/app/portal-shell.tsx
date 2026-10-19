"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Permission, UserRole } from "@dantown/shared";
import { OrderAttentionAlerts } from "@/components/admin/order-attention-alerts";
import { WorkspaceQuickActions } from "@/components/admin/workspace-quick-actions";
import { InstallCentreApp } from "@/components/centre/install-app-button";
import { ResponsiveSidebar, type SidebarSection } from "@/components/navigation/responsive-sidebar";
import { DanTAI } from "@/components/dan-t-ai";

type PortalNavigationItem = {
  label: string;
  href?: string;
  icon: string;
  permission?: Permission;
  permissions?: Permission[];
  disabledReason?: string;
  children?: PortalNavigationItem[];
};

const portalNavigationGroups: PortalNavigationItem[] = [
  {
    label: "Business Documents",
    href: "/admin/documents",
    icon: "FileText",
    children: [
      { label: "All Documents", href: "/admin/documents", icon: "FileText", permission: "settings.manage" },
      { label: "Invoices", href: "/admin/documents?group=SALES&type=INVOICE", icon: "Receipt", permission: "settings.manage" },
      { label: "Delivery Notes", href: "/admin/documents?group=INVENTORY&type=DELIVERY_NOTE", icon: "Truck", permission: "settings.manage" },
      { label: "Purchase Orders", href: "/admin/documents?group=PURCHASES&type=PURCHASE_ORDER", icon: "ShoppingCart", permission: "settings.manage" },
      { label: "Receipts", href: "/admin/documents?group=SALES&type=RECEIPT", icon: "Receipt", permission: "settings.manage" },
      { label: "Quotations and Estimates", href: "/admin/documents?group=SALES&type=QUOTATION", icon: "Quote", permission: "settings.manage" },
      { label: "Credit Notes", href: "/admin/documents?group=SALES&type=CREDIT_NOTE", icon: "FileText", permission: "settings.manage" },
      { label: "Supplier Documents", href: "/admin/documents?group=PURCHASES", icon: "Truck", permission: "settings.manage" },
    ],
  },
  {
    label: "Orders",
    href: "/admin/orders",
    icon: "ShoppingCart",
    children: [
      { label: "All Orders", href: "/admin/orders", icon: "ShoppingCart", permission: "orders.read" },
      { label: "Pending", href: "/admin/orders?status=pending", icon: "Activity", permission: "orders.read" },
      { label: "Processing", href: "/admin/orders?status=processing", icon: "Activity", permission: "orders.read" },
      { label: "Completed", href: "/admin/orders?status=completed", icon: "Package", permission: "orders.read" },
      { label: "Cancelled", href: "/admin/orders?status=cancelled", icon: "X", permission: "orders.read" },
      { label: "Returns", href: "/admin/orders?status=returns", icon: "History", permission: "orders.read" },
    ],
  },
  {
    label: "Inventory",
    href: "/admin/inventory",
    icon: "Boxes",
    children: [
      { label: "All Stock", href: "/admin/inventory", icon: "Boxes", permission: "inventory.read" },
      { label: "Low Stock", href: "/admin/inventory?filter=low-stock", icon: "Activity", permission: "inventory.read" },
      { label: "Stock Adjustments", href: "/admin/inventory", icon: "Wrench", permission: "inventory.read" },
      { label: "Stock Movements", href: "/admin/inventory/movements", icon: "History", permission: "inventory.read" },
      { label: "Categories", href: "/admin/categories", icon: "Boxes", permission: "products.update" },
    ],
  },
  {
    label: "Customers",
    href: "/admin/customers",
    icon: "UsersRound",
    children: [
      { label: "Customer Directory", href: "/admin/customers", icon: "UsersRound", permission: "customers.read" },
      { label: "Customer Accounts", disabledReason: "A dedicated customer-accounts workspace has not been implemented.", icon: "UserRound", permission: "customers.read" },
      { label: "Outstanding Balances", disabledReason: "Customer balance reporting is not implemented.", icon: "DollarSign", permission: "customers.read" },
      { label: "Purchase History", disabledReason: "A customer-specific purchase-history view has not been implemented.", icon: "History", permission: "customers.read" },
    ],
  },
  {
    label: "Sales",
    href: "/admin/orders",
    icon: "ChartNoAxesCombined",
    children: [
      { label: "Sales Overview", href: "/admin/dashboard", icon: "ChartNoAxesCombined", permission: "reports.read" },
      { label: "Sales Transactions", href: "/admin/orders", icon: "Receipt", permission: "orders.read" },
      { label: "Sales Reports", disabledReason: "A dedicated sales-reports workspace has not been implemented.", icon: "FileText", permission: "reports.read" },
    ],
  },
  {
    label: "Payments",
    href: "/admin/payments",
    icon: "CreditCard",
    children: [
      { label: "Payment Records", href: "/admin/payments", icon: "CreditCard", permission: "payments.read" },
      { label: "Reconciliation", disabledReason: "Payment reconciliation is not implemented.", icon: "Activity", permission: "payments.read" },
      { label: "Refunds", href: "/admin/payments?status=refunds", icon: "History", permission: "payments.read" },
      { label: "Failed Transactions", href: "/admin/payments?status=FAILED", icon: "Activity", permission: "payments.read" },
    ],
  },
  {
    label: "Automation",
    href: "/admin/automation",
    icon: "Zap",
    children: [
      { label: "Workflows", href: "/admin/automation", icon: "Zap", permission: "automation.read" },
      { label: "Webhooks", disabledReason: "A webhook-management workspace has not been implemented.", icon: "Activity", permission: "automation.read" },
      { label: "Execution History", href: "/admin/automation/history", icon: "History", permission: "automation.read" },
      { label: "Failed Jobs", disabledReason: "The existing page does not load actual failed-job records yet.", icon: "Activity", permission: "automation.read" },
      { label: "Integration Settings", href: "/admin/settings/notifications-and-integrations", icon: "Settings", permission: "users.read" },
    ],
  },
  {
    label: "AI Knowledge",
    href: "/admin/knowledge",
    icon: "FileText",
    children: [
      { label: "Knowledge Base", href: "/admin/knowledge", icon: "FileText", permission: "settings.manage" },
      { label: "Documents", disabledReason: "AI document ingestion is not implemented.", icon: "FileText", permission: "settings.manage" },
      { label: "Bot Instructions", disabledReason: "A separate bot-instructions editor has not been implemented.", icon: "Wrench", permission: "settings.manage" },
      { label: "Chat History", disabledReason: "AI chat history is not persisted in the application.", icon: "History", permission: "settings.manage" },
      { label: "AI Settings", href: "/admin/settings/ai-assistant", icon: "Settings", permission: "users.read" },
    ],
  },
  {
    label: "Team",
    href: "/admin/team",
    icon: "UsersRound",
    children: [
      { label: "Staff Directory", href: "/admin/team", icon: "UsersRound", permission: "users.read" },
      { label: "Roles and Permissions", href: "/admin/team", icon: "ShieldCheck", permissions: ["users.read", "roles.read"] },
      { label: "Attendance", disabledReason: "Staff attendance tracking has not been implemented.", icon: "Activity", permission: "users.read" },
      { label: "Access Settings", href: "/admin/business-center-access", icon: "ShieldCheck", permission: "users.manage" },
    ],
  },
];

type PortalShellProps = {
  title: string;
  description: string;
  roles: UserRole[];
  permissions: Permission[];
  links: Array<{
    label: string;
    href: string;
    permission?: Permission;
    roles?: UserRole[];
  }>;
  children: ReactNode;
  showBsk?: boolean;
  wide?: boolean;
};

export function PortalShell({
  title,
  description,
  roles,
  permissions,
  links,
  children,
  wide = false
}: PortalShellProps) {
  const visibleLinks = links.filter(
    (link) =>
      (!link.permission || permissions.includes(link.permission)) &&
      (!link.roles || link.roles.some((role) => roles.includes(role)))
  );
  const reservedLabels = new Set(portalNavigationGroups.map((group) => group.label));
  const navigationGroups = portalNavigationGroups.flatMap((group) => {
    const children = (group.children ?? []).filter(
      (child) =>
        (!child.permission || permissions.includes(child.permission)) &&
        (!child.permissions || child.permissions.every((permission) => permissions.includes(permission)))
    );
    return children.length ? [{ ...group, children }] : [];
  });
  const sidebarLinks = [
    ...visibleLinks.filter((link) => !reservedLabels.has(link.label)).map((link) => ({
      ...link,
      icon: ({
        Overview: "LayoutDashboard",
        POS: "Store",
        Marketplace: "ShoppingBag",
        Products: "Package",
        Promotions: "Zap",
        Projects: "BriefcaseBusiness",
        Quotations: "Quote",
        Technicians: "Wrench",
        Suppliers: "Truck",
        Analytics: "ChartNoAxesCombined",
        "Roles & Permissions": "ShieldCheck",
        Settings: "Settings",
        "System Activity": "Activity",
        "Audit Logs": "FileText",
        "CEO view": "ChartNoAxesCombined",
      } as Record<string, string>)[link.label] ?? "CircleHelp",
    })),
    ...navigationGroups,
  ];
  const canAccessPrivateWorkspace =
    roles.includes("ADMIN") ||
    roles.includes("CEO") ||
    ["inventory.read", "users.read", "reports.read"].some((permission) =>
      permissions.includes(permission as Permission)
    );
  const primary = sidebarLinks.filter((link) =>
    [
      "Overview",
      "POS",
      "Marketplace",
      "Inventory",
      "Orders",
      "Customers",
      "Projects",
      "Quotations",
      "Technicians",
      "Suppliers",
      "Analytics"
    ].includes(link.label)
  );
  const management = sidebarLinks.filter(
    (link) =>
      !primary.includes(link) &&
      ![
        "Team",
        "Roles & Permissions",
        "Settings",
        "System Activity",
        "Audit Logs",
        "CEO view"
      ].includes(link.label)
  );
  const administration = sidebarLinks.filter(
    (link) => !primary.includes(link) && !management.includes(link)
  );
  const sidebarSections: SidebarSection[] = [
    { label: "Primary", links: primary },
    { label: "Business management", links: management },
    { label: "Management", links: administration }
  ].filter((section) => section.links.length > 0);

  return (
    <main className="portal">
      <OrderAttentionAlerts />
      <header className="portal-header">
        <Link className="brand" href="/centre">
          <span className="brand-mark">D</span>
          <span>
            DANTOWN <b>ELECTRICAL</b>
          </span>
        </Link>
        <div className="portal-header-meta">
          <span className="portal-live">
            <i /> Supabase connected
          </span>
          <InstallCentreApp />
          <Link className="portal-header-gateway centre-shop-link" href="/">
            View shop
          </Link>
          <Link className="button button-secondary" href="/logout">
            Sign out
          </Link>
        </div>
      </header>
      <div className={`portal-body${wide ? " portal-body-wide" : ""}`}>
        <ResponsiveSidebar
          ariaLabel="Portal navigation"
          storageKey="dantown-portal-sidebar"
          variant="portal"
          sections={sidebarSections}
          header={
            <Link className="responsive-sidebar-brand-link" href="/centre">
              <span className="brand-mark" aria-hidden="true">D</span>
              <span className="responsive-sidebar-brand-copy">Workspace</span>
            </Link>
          }
        />
        <section className="portal-main">
          <div className="portal-heading">
            <div>
              <p className="eyebrow">Dantown Electrical / Operations</p>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            <div className="portal-role">{roles[0] ?? "Team member"}</div>
          </div>
          {canAccessPrivateWorkspace && <WorkspaceQuickActions />}
          {children}
        </section>
      </div>
      <DanTAI />
    </main>
  );
}
