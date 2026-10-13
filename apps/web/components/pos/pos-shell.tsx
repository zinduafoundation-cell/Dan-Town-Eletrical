"use client";

import { ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut, Wifi, WifiOff, Home, Plus, History, Users, Package, DollarSign, FileText, Settings, Zap, type LucideIcon } from "lucide-react";
import type { Permission } from "@dantown/shared";
import { getOfflineQueueSummary } from "@/lib/pos/offline-queue";
import { getOfflinePOSProducts, saveCentreOfflineAccess } from "@/lib/centre/offline-storage";
import { downloadOfflinePOSCatalogue, isWifiConnection } from "@/lib/centre/offline-catalogue";

const subscribeToNetwork = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

const getNetworkStatus = () => navigator.onLine;
const getServerNetworkStatus = () => true;

export function POSShell({
  children,
  permissions,
  staffUserId,
  centreAuthorized,
  staffName = "Staff Member",
  staffRole = "Cashier"
}: {
  children: ReactNode;
  permissions: Permission[];
  staffUserId: string | null;
  centreAuthorized: boolean;
  staffName?: string;
  staffRole?: string;
}) {
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);
  const [offlineCatalogueStatus, setOfflineCatalogueStatus] = useState<string | null>(null);
  const [catalogueDownloading, setCatalogueDownloading] = useState(false);
  const catalogueDownloadLock = useRef(false);
  const downloadCatalogue = useCallback(async () => {
    if (catalogueDownloadLock.current || !staffUserId) return;
    catalogueDownloadLock.current = true;
    setCatalogueDownloading(true);
    setOfflineCatalogueStatus("Preparing offline product catalogue…");
    try {
      const count = await downloadOfflinePOSCatalogue(setOfflineCatalogueStatus);
      setOfflineCatalogueStatus(`${count} products ready offline`);
    } catch (error) {
      console.error("Unable to prepare the offline POS catalogue.", error);
      setOfflineCatalogueStatus(error instanceof Error ? error.message : "Offline catalogue download failed.");
    } finally {
      catalogueDownloadLock.current = false;
      setCatalogueDownloading(false);
    }
  }, [staffUserId]);
  useEffect(() => {
    if (!staffUserId) return;
    let active = true;
    void (async () => {
      try {
        await saveCentreOfflineAccess({ userId: staffUserId, staffName, staffRole, permissions, centreAuthorized });
        if (!permissions.includes("orders.create")) return;
        const catalogue = await getOfflinePOSProducts();
        const isFresh = catalogue?.complete &&
          Date.now() - new Date(catalogue.savedAt).getTime() < 24 * 60 * 60 * 1000;
        if (isFresh) {
          if (active) setOfflineCatalogueStatus(`${catalogue.products.length} products ready offline`);
          return;
        }
        if (!isWifiConnection()) {
          if (active) setOfflineCatalogueStatus("Connect to Wi-Fi to prepare the offline product catalogue");
          return;
        }
        if (active) await downloadCatalogue();
      } catch (error) {
        console.error("Unable to prepare the offline POS catalogue.", error);
        if (active) setOfflineCatalogueStatus(error instanceof Error ? error.message : "Offline catalogue download failed.");
      }
    })();
    return () => { active = false; };
  }, [centreAuthorized, downloadCatalogue, permissions, staffName, staffRole, staffUserId]);
  useEffect(() => {
    const initialTimer = setTimeout(() => setNow(new Date()), 0);
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, []);
  const isOnline = useSyncExternalStore(subscribeToNetwork, getNetworkStatus, getServerNetworkStatus);
  const [queueSummary, setQueueSummary] = useState({ PENDING: 0, SYNCING: 0, SYNCED: 0, FAILED: 0, CONFLICT: 0 });
  useEffect(() => {
    const refreshQueue = () => getOfflineQueueSummary().then(setQueueSummary).catch((error) => {
      console.error("Unable to read offline POS queue status.", error);
    });
    refreshQueue();
    window.addEventListener("online", refreshQueue);
    window.addEventListener("dantown-pos-sync", refreshQueue);
    return () => {
      window.removeEventListener("online", refreshQueue);
      window.removeEventListener("dantown-pos-sync", refreshQueue);
    };
  }, []);
  const navigation: Array<{ icon: LucideIcon; label: string; href: string; permission: Permission | null }> = [
    { icon: Home, label: "Dashboard", href: "/pos", permission: null },
    { icon: Plus, label: "New Sale", href: "/pos/new-sale", permission: "orders.create" },
    { icon: History, label: "Sales History", href: "/pos/sales-history", permission: "orders.read" },
    { icon: Users, label: "Customers", href: "/pos/customers", permission: "customers.read" },
    { icon: Package, label: "Inventory", href: "/pos/inventory", permission: "inventory.read" },
    { icon: DollarSign, label: "Cash", href: "/pos/cash", permission: null },
    { icon: FileText, label: "Reports", href: "/pos/reports", permission: "reports.read" },
    { icon: Settings, label: "Settings", href: "/pos/settings", permission: null },
  ];

  const visibleNav = navigation.filter(
    (item) => !item.permission || permissions.includes(item.permission)
  );

  return (
    <div className="pos-container">
      {/* POS Sidebar */}
      <aside className="pos-sidebar" aria-label="POS Navigation">
        <div className="pos-sidebar-header">
          <div className="pos-logo">
            <span className="pos-logo-mark"><Zap aria-hidden="true" size={18} /></span>
            <div>
              <div className="pos-logo-text">DANTOWN</div>
              <div className="pos-logo-subtext">POS</div>
            </div>
          </div>
        </div>

        <nav className="pos-nav">
          {visibleNav.map((item) => (
            <Link key={item.href} href={item.href} className={`pos-nav-item ${pathname === item.href || (item.href !== "/pos" && pathname.startsWith(`${item.href}/`)) ? "active" : ""}`} aria-current={pathname === item.href || (item.href !== "/pos" && pathname.startsWith(`${item.href}/`)) ? "page" : undefined}>
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="pos-sidebar-footer">
          <div className="pos-staff-info">
            <div className="pos-staff-avatar">{staffName.charAt(0).toUpperCase()}</div>
            <div>
              <div className="pos-staff-name">{staffName}</div>
              <div className="pos-staff-role">{staffRole}</div>
            </div>
          </div>
          <button className="pos-sidebar-button pos-lock-button" title="Lock POS" aria-label="Lock POS">
            <Menu size={18} />
          </button>
          <Link href="/logout" className="pos-sidebar-button pos-logout-button" title="Logout" aria-label="Log out of POS">
            <LogOut size={18} />
          </Link>
        </div>
      </aside>

      {/* POS Main Content */}
      <div className="pos-main">
        {/* POS Topbar */}
        <header className="pos-topbar">
          <div className="pos-topbar-left">
            <div className="pos-topbar-title">DANTOWN POS</div>
            <input
              type="text"
              placeholder="Search products, SKU or barcode..."
              className="pos-search-input"
              aria-label="Search POS products"
              autoComplete="off"
              onChange={(event) => window.dispatchEvent(new CustomEvent("dantown-pos-search", { detail: event.target.value }))}
            />
          </div>

          <div className="pos-topbar-right">
            {/* Network Status */}
            <div className={`pos-status-indicator ${isOnline ? "online" : "offline"}`}>
              {isOnline ? (
                <>
                  <Wifi size={16} />
                  <span>ONLINE</span>
                </>
              ) : (
                <>
                  <WifiOff size={16} />
                  <span>OFFLINE MODE</span>
                </>
              )}
            </div>

            {/* Sync Status */}
            <div className="pos-sync-status">
              <span className="pos-sync-text">{queueSummary.PENDING + queueSummary.SYNCING + queueSummary.FAILED + queueSummary.CONFLICT ? `${queueSummary.PENDING + queueSummary.SYNCING} pending · ${queueSummary.FAILED + queueSummary.CONFLICT} need review` : "All changes synced"}</span>
              {offlineCatalogueStatus && <span className="pos-sync-text">{offlineCatalogueStatus}</span>}
              {permissions.includes("orders.create") && !offlineCatalogueStatus?.includes("ready offline") &&
                <button type="button" className="pos-topbar-button" onClick={() => void downloadCatalogue()} disabled={catalogueDownloading}>
                  {catalogueDownloading ? "Downloading…" : "Download offline catalogue"}
                </button>}
            </div>

            {/* Date/Time */}
            <div className="pos-datetime">
              {now
                ? now.toLocaleDateString("en-KE", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                  })
                : ""}
            </div>

            {/* Notifications */}
            <button className="pos-topbar-button" title="Notifications" aria-label="Notifications">
              🔔
            </button>
          </div>
        </header>

        {/* POS Content */}
        <main className="pos-content">{children}</main>
      </div>
    </div>
  );
}