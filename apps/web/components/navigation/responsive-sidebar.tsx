"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BriefcaseBusiness,
  Boxes,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CreditCard,
  DollarSign,
  FileText,
  Heart,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Plus,
  Quote,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  UserRound,
  UsersRound,
  Wrench,
  X,
  Zap,
  type LucideIcon
} from "lucide-react";

export type SidebarLink = {
  label: string;
  href: string;
  icon: string;
  badge?: string;
};

export type SidebarSection = {
  label?: string;
  links: SidebarLink[];
};

type ResponsiveSidebarProps = {
  ariaLabel: string;
  storageKey: string;
  variant: "portal" | "pos" | "account";
  sections: SidebarSection[];
  header: ReactNode;
  footer?: ReactNode;
  actions?: SidebarLink[];
};

const mobileQuery = "(max-width: 960px)";
const sidebarPreferenceCache = new Map<string, boolean>();

const sidebarIcons: Record<string, LucideIcon> = {
  Activity,
  BriefcaseBusiness,
  Boxes,
  ChartNoAxesCombined,
  CircleHelp,
  CreditCard,
  DollarSign,
  FileText,
  Heart,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Plus,
  Quote,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  UserRound,
  UsersRound,
  Wrench,
  Zap
};

export function isSidebarLinkActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export function ResponsiveSidebar({
  ariaLabel,
  storageKey,
  variant,
  sections,
  header,
  footer,
  actions = []
}: ResponsiveSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeHref = sections
    .flatMap((section) => section.links)
    .filter(({ href }) => isSidebarLinkActive(pathname, href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const subscribeToPreference = useCallback((onChange: () => void) => {
    const onPreferenceChange = (event: Event) => {
      if (event instanceof CustomEvent && event.detail !== storageKey) return;
      if (event instanceof StorageEvent) {
        if (event.key !== storageKey) return;
        if (event.newValue === null) sidebarPreferenceCache.delete(storageKey);
      }
      onChange();
    };
    window.addEventListener("storage", onPreferenceChange);
    window.addEventListener("dantown-sidebar-preference", onPreferenceChange);
    return () => {
      window.removeEventListener("storage", onPreferenceChange);
      window.removeEventListener("dantown-sidebar-preference", onPreferenceChange);
    };
  }, [storageKey]);
  const getPreferenceSnapshot = useCallback(() => {
    try {
      const savedPreference = window.localStorage.getItem(storageKey);
      if (savedPreference !== null) {
        const savedCollapsed = savedPreference === "collapsed";
        sidebarPreferenceCache.set(storageKey, savedCollapsed);
        return savedCollapsed;
      }
      return sidebarPreferenceCache.get(storageKey) ?? false;
    } catch (error) {
      console.warn("Unable to restore sidebar preference.", error);
      return sidebarPreferenceCache.get(storageKey) ?? false;
    }
  }, [storageKey]);
  const collapsed = useSyncExternalStore(subscribeToPreference, getPreferenceSnapshot, () => false);

  useEffect(() => {
    const media = window.matchMedia(mobileQuery);
    const updateViewport = () => {
      setIsMobile(media.matches);
      if (!media.matches) setMobileOpen(false);
    };
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (!mobileOpen || !isMobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const inerted: Array<{ element: HTMLElement; wasInert: boolean }> = [];
    let current = asideRef.current;
    while (current && current !== document.body) {
      const parent = current.parentElement;
      if (!parent) break;
      for (const sibling of Array.from(parent.children)) {
        if (!(sibling instanceof HTMLElement) || sibling === current || sibling.classList.contains("responsive-sidebar-backdrop")) continue;
        inerted.push({ element: sibling, wasInert: sibling.inert });
        sibling.inert = true;
      }
      current = parent;
    }
    const firstLink = asideRef.current?.querySelector<HTMLElement>("a, button");
    firstLink?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab" || !asideRef.current) return;
      const focusable = Array.from(asideRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      inerted.forEach(({ element, wasInert }) => { element.inert = wasInert; });
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobile, mobileOpen]);

  const toggleCollapsed = useCallback(() => {
    const next = !collapsed;
    sidebarPreferenceCache.set(storageKey, next);
    try {
      window.localStorage.setItem(storageKey, next ? "collapsed" : "expanded");
    } catch (error) {
      console.warn("Unable to persist sidebar preference; keeping it for this session.", error);
    }
    window.dispatchEvent(new CustomEvent("dantown-sidebar-preference", { detail: storageKey }));
  }, [collapsed, storageKey]);
  const closeMobile = () => {
    setMobileOpen(false);
    if (isMobile) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const activeLink = (href: string) => href === activeHref;

  return (
    <div className={`responsive-sidebar-shell responsive-sidebar-${variant}${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}>
      <button
        ref={triggerRef}
        className="responsive-sidebar-mobile-toggle"
        type="button"
        aria-label={`Open ${ariaLabel}`}
        aria-expanded={mobileOpen}
        aria-controls={`${storageKey}-navigation`}
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={20} aria-hidden="true" />
      </button>
      {isMobile && mobileOpen && (
        <button
          className="responsive-sidebar-backdrop"
          type="button"
          aria-label={`Close ${ariaLabel}`}
          onClick={() => {
            setMobileOpen(false);
            window.requestAnimationFrame(() => triggerRef.current?.focus());
          }}
        />
      )}
      <aside
        ref={asideRef}
        id={`${storageKey}-navigation`}
        className={`responsive-sidebar responsive-sidebar-${variant} ${variant}-sidebar`}
        aria-label={ariaLabel}
        aria-modal={isMobile && mobileOpen ? true : undefined}
        role={isMobile && mobileOpen ? "dialog" : "complementary"}
        aria-hidden={isMobile && !mobileOpen}
        inert={isMobile && !mobileOpen}
      >
        <div className="responsive-sidebar-heading">
          <div className="responsive-sidebar-brand">{header}</div>
          <button
            className="responsive-sidebar-collapse"
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button
            className="responsive-sidebar-mobile-close"
            type="button"
            aria-label={`Close ${ariaLabel}`}
            onClick={() => {
              setMobileOpen(false);
              window.requestAnimationFrame(() => triggerRef.current?.focus());
            }}
          >
            <X size={19} />
          </button>
        </div>
        <nav className="responsive-sidebar-nav">
          {sections.map((section, sectionIndex) => (
            <div className="responsive-sidebar-section" key={`${section.label ?? "navigation"}-${sectionIndex}`}>
              {section.label && <p className="responsive-sidebar-section-label">{section.label}</p>}
              {section.links.map(({ label, href, icon, badge }) => {
                const Icon = sidebarIcons[icon] ?? CircleHelp;
                const active = activeLink(href);
                return (
                  <Link
                    className={`responsive-sidebar-link${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    aria-label={label}
                    data-label={label}
                    href={href}
                    key={href}
                    onClick={closeMobile}
                    title={collapsed ? label : undefined}
                  >
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    <span className="responsive-sidebar-link-label">{label}</span>
                    {badge && <span className="responsive-sidebar-badge">{badge}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        {(footer || actions.length > 0) && (
          <div className="responsive-sidebar-footer">
            {footer && <div className="responsive-sidebar-context">{footer}</div>}
            {actions.map(({ label, href, icon }) => {
              const Icon = sidebarIcons[icon] ?? CircleHelp;
              return (
                <Link
                  className="responsive-sidebar-link responsive-sidebar-action"
                  aria-label={label}
                  data-label={label}
                  href={href}
                  key={href}
                  onClick={closeMobile}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span className="responsive-sidebar-link-label">{label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}
