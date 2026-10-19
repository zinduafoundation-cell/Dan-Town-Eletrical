"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BriefcaseBusiness,
  Boxes,
  ChartNoAxesCombined,
  ChevronDown,
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
  href?: string;
  icon: string;
  badge?: string;
  children?: SidebarLink[];
  disabledReason?: string;
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
  X,
  Zap
};

export function isSidebarLinkActive(pathname: string, href: string, search = "") {
  const target = new URL(href, "https://dantown.invalid");
  const targetPath = target.pathname;
  const pathMatches = pathname === targetPath || (targetPath !== "/" && pathname.startsWith(`${targetPath}/`));
  if (!pathMatches || target.searchParams.size === 0) return pathMatches;
  const currentSearch = new URLSearchParams(search);
  return [...target.searchParams].every(([key, value]) => currentSearch.get(key) === value);
}

export function isSidebarGroupActive(pathname: string, children: SidebarLink[], search = "") {
  return children.some((child) => child.href && isSidebarLinkActive(pathname, child.href, search));
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
  const [currentSearch, setCurrentSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const asideRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeHref = sections
    .flatMap((section) => section.links.flatMap((link) => [link, ...(link.children ?? [])]))
    .filter((link) => link.href)
    .filter((link): link is SidebarLink & { href: string } => Boolean(link.href))
    .filter(({ href }) => isSidebarLinkActive(pathname, href, currentSearch))
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
    const updateSearch = () => setCurrentSearch(window.location.search);
    updateSearch();
    window.addEventListener("popstate", updateSearch);
    return () => window.removeEventListener("popstate", updateSearch);
  }, [pathname]);

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
  const handleLinkClick = (href: string) => {
    setCurrentSearch(new URL(href, window.location.origin).search);
    closeMobile();
  };

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
              {section.links.map(({ label, href, icon, badge, children, disabledReason }, linkIndex) => {
                const Icon = sidebarIcons[icon] ?? CircleHelp;
                const active = href ? activeLink(href) : false;
                const groupActive = children?.length ? isSidebarGroupActive(pathname, children, currentSearch) : false;
                const groupKey = `${sectionIndex}-${linkIndex}`;
                const submenuId = `${storageKey}-submenu-${sectionIndex}-${linkIndex}`;
                const expanded = expandedGroups[groupKey] ?? groupActive;
                if (children?.length) {
                  return (
                    <div className="responsive-sidebar-group" key={`${label}-${href ?? "group"}`}>
                      <button
                        className={`responsive-sidebar-link responsive-sidebar-group-toggle${groupActive ? " active" : ""}`}
                        type="button"
                        aria-label={label}
                        aria-expanded={expanded}
                        aria-controls={submenuId}
                        data-label={label}
                        onClick={() => setExpandedGroups((current) => ({ ...current, [groupKey]: !expanded }))}
                        title={collapsed ? label : undefined}
                      >
                        <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                        <span className="responsive-sidebar-link-label">{label}</span>
                        <ChevronDown className="responsive-sidebar-chevron" size={16} aria-hidden="true" />
                      </button>
                      <div className="responsive-sidebar-submenu" id={submenuId} hidden={!expanded}>
                        {children.map((child) => {
                          const ChildIcon = sidebarIcons[child.icon] ?? CircleHelp;
                          const childActive = child.href ? activeLink(child.href) : false;
                          return child.href ? (
                            <Link
                              className={`responsive-sidebar-link responsive-sidebar-sublink${childActive ? " active" : ""}`}
                              aria-current={childActive ? "page" : undefined}
                              aria-label={child.label}
                              data-label={child.label}
                              href={child.href}
                              key={`${child.label}-${child.href}`}
                              onClick={() => child.href && handleLinkClick(child.href)}
                              title={collapsed ? child.label : undefined}
                            >
                              <ChildIcon size={17} strokeWidth={1.8} aria-hidden="true" />
                              <span className="responsive-sidebar-link-label">{child.label}</span>
                            </Link>
                          ) : (
                            <span
                              className="responsive-sidebar-link responsive-sidebar-sublink is-disabled"
                              aria-label={`${child.label}. Not implemented. ${child.disabledReason ?? ""}`}
                              aria-disabled="true"
                              key={child.label}
                              title={child.disabledReason}
                            >
                              <ChildIcon size={17} strokeWidth={1.8} aria-hidden="true" />
                              <span className="responsive-sidebar-link-label">{child.label}</span>
                              <span className="responsive-sidebar-unavailable">Not implemented</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                if (!href) {
                  return (
                    <span
                      className="responsive-sidebar-link is-disabled"
                      aria-disabled="true"
                      data-label={label}
                      key={label}
                      title={disabledReason}
                    >
                      <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                      <span className="responsive-sidebar-link-label">{label}</span>
                    </span>
                  );
                }
                return (
                  <Link
                    className={`responsive-sidebar-link${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    aria-label={label}
                    data-label={label}
                    href={href}
                    key={href}
                    onClick={() => handleLinkClick(href)}
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
