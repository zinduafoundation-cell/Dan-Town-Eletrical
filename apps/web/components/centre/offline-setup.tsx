"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Permission } from "@dantown/shared";
import {
  getOfflinePOSProducts,
  saveCentreOfflineAccess,
  saveCentreOfflineSnapshot,
  type CentreOfflineSnapshot,
} from "@/lib/centre/offline-storage";
import { downloadOfflinePOSCatalogue, isWifiConnection } from "@/lib/centre/offline-catalogue";

type Props = {
  userId: string;
  staffName: string;
  staffRole: string;
  permissions: Permission[];
  centreAuthorized: boolean;
  snapshot: Omit<CentreOfflineSnapshot, "userId" | "savedAt">;
};

export function CentreOfflineSetup({ userId, staffName, staffRole, permissions, centreAuthorized, snapshot }: Props) {
  const [catalogueCount, setCatalogueCount] = useState<number | null>(null);
  const [catalogueSavedAt, setCatalogueSavedAt] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const downloading = useRef(false);

  const downloadCatalogue = useCallback(async () => {
    if (downloading.current || !navigator.onLine || !permissions.includes("orders.create")) return;
    downloading.current = true;
    setIsDownloading(true);
    setError(null);
    setProgress("Preparing product catalogue…");
    try {
      const count = await downloadOfflinePOSCatalogue(setProgress);
      const savedAt = new Date().toISOString();
      setCatalogueCount(count);
      setCatalogueSavedAt(savedAt);
      setProgress(`Offline POS ready with ${count} products.`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Product catalogue download failed.");
      setProgress(null);
    } finally {
      downloading.current = false;
      setIsDownloading(false);
    }
  }, [permissions]);

  useEffect(() => {
    void Promise.all([
      saveCentreOfflineAccess({ userId, staffName, staffRole, permissions, centreAuthorized }),
      saveCentreOfflineSnapshot({ ...snapshot, userId, savedAt: new Date().toISOString() }),
      getOfflinePOSProducts(),
    ]).then(([, , catalogue]) => {
      if (catalogue) {
        setCatalogueCount(catalogue.products.length);
        setCatalogueSavedAt(catalogue.savedAt);
      }
      const catalogueIsFresh = catalogue?.complete &&
        Date.now() - new Date(catalogue.savedAt).getTime() < 24 * 60 * 60 * 1000;
      if (isWifiConnection() && !catalogueIsFresh && permissions.includes("orders.create")) {
        void downloadCatalogue();
      }
    }).catch((saveError) => {
      console.error("Unable to prepare Centre offline data.", saveError);
      setError("Centre access could not be prepared for offline use on this device.");
    });
  }, [centreAuthorized, downloadCatalogue, permissions, snapshot, staffName, staffRole, userId]);

  if (!permissions.includes("orders.create")) return null;

  return (
    <section className="portal-card centre-offline-setup" aria-live="polite">
      <div>
        <p className="eyebrow">Offline readiness</p>
        <h2>Prepare this device for offline POS</h2>
        <p>Centre access and a recent dashboard snapshot are saved on this device. Download the full active catalogue while online to use POS without a connection.</p>
        {catalogueSavedAt && <small>{catalogueCount} products saved {new Date(catalogueSavedAt).toLocaleString()}</small>}
        {progress && <p role="status">{progress}</p>}
        {error && <p role="alert">{error}</p>}
      </div>
      <button type="button" className="button button-secondary" onClick={() => void downloadCatalogue()} disabled={isDownloading}>
        {isDownloading ? "Downloading…" : catalogueSavedAt ? "Refresh offline catalogue" : "Download offline catalogue"}
      </button>
    </section>
  );
}
