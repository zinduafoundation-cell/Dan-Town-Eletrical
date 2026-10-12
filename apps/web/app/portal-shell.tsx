"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { Permission, UserRole } from "@dantown/shared";
import { OrderAttentionAlerts } from "@/components/admin/order-attention-alerts";
import { WorkspaceQuickActions } from "@/components/admin/workspace-quick-actions";
import { InstallCentreApp } from "@/components/centre/install-app-button";

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
  const pathname = usePathname();
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
  );const activeHref = [...visibleLinks]
    .filter(
      (link) =>
        pathname === link.href || pathname.startsWith(`${link.href}/`)
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const isActive = (href: string) => href === activeHref;
  const administration = visibleLinks.filter(
    (link) => !primary.includes(link) && !management.includes(link)
  );
  
  const renderLinks = (items: typeof visibleLinks) =>
    items.map((link) => (
      <Link
        className={isActive(link.href) ? "active" : undefined}
        aria-current={isActive(link.href) ? "page" : undefined}
        href={link.href}
        key={link.href}
      >
        {link.label}
      </Link>
    ));

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
        <aside className="portal-sidebar" aria-label="Portal navigation">
          <div className="portal-sidebar-label">Workspace</div>
          {primary.length > 0 && (
            <>
              <div className="portal-sidebar-group">Primary</div>
              {renderLinks(primary)}
            </>
          )}
          {management.length > 0 && (
            <>
              <div className="portal-sidebar-group">Business management</div>
              {renderLinks(management)}
            </>
          )}
          {administration.length > 0 && (
            <>
              <div className="portal-sidebar-group">Management</div>
              {renderLinks(administration)}
            </>
          )}
          </aside>
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
    </main>
  );
}
