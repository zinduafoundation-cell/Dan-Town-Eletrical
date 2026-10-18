"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Permission, UserRole } from "@dantown/shared";
import { OrderAttentionAlerts } from "@/components/admin/order-attention-alerts";
import { WorkspaceQuickActions } from "@/components/admin/workspace-quick-actions";
import { InstallCentreApp } from "@/components/centre/install-app-button";
import { ResponsiveSidebar, type SidebarSection } from "@/components/navigation/responsive-sidebar";
import { DanTAI } from "@/components/dan-t-ai";

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
  const canAccessPrivateWorkspace =
    roles.includes("ADMIN") ||
    roles.includes("CEO") ||
    ["inventory.read", "users.read", "reports.read"].some((permission) =>
      permissions.includes(permission as Permission)
    );
  const primary = visibleLinks.filter((link) =>
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
  const management = visibleLinks.filter(
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
  const administration = visibleLinks.filter(
    (link) => !primary.includes(link) && !management.includes(link)
  );
  const getIcon = (label: string) => {
    const icons: Record<string, string> = {
      Overview: "LayoutDashboard",
      POS: "Store",
      Marketplace: "ShoppingBag",
      Inventory: "Boxes",
      Orders: "ShoppingCart",
      Customers: "UsersRound",
      Projects: "BriefcaseBusiness",
      Quotations: "Quote",
      Technicians: "Wrench",
      Suppliers: "Truck",
      Analytics: "ChartNoAxesCombined",
      Team: "UsersRound",
      "Roles & Permissions": "ShieldCheck",
      Settings: "Settings",
      "System Activity": "Activity",
      "Audit Logs": "FileText",
      "CEO view": "ChartNoAxesCombined"
    };
    return icons[label] ?? "CircleHelp";
  };
  const sidebarSections: SidebarSection[] = [
    { label: "Primary", links: primary.map((link) => ({ ...link, icon: getIcon(link.label) })) },
    { label: "Business management", links: management.map((link) => ({ ...link, icon: getIcon(link.label) })) },
    { label: "Management", links: administration.map((link) => ({ ...link, icon: getIcon(link.label) })) }
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
