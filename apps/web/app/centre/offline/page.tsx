"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, WifiOff } from "lucide-react";
import NewSalePage from "@/app/pos/new-sale/page";
import { clearCentreOfflineData, getCentreOfflineAccess, getCentreOfflineSnapshot, type CentreOfflineAccess, type CentreOfflineSnapshot } from "@/lib/centre/offline-storage";
import { getOfflineQueueSummary } from "@/lib/pos/offline-queue";

export default function CentreOfflinePage() {
  const [access, setAccess] = useState<CentreOfflineAccess | null>(null);
  const [snapshot, setSnapshot] = useState<CentreOfflineSnapshot | null>(null);
  const [queue, setQueue] = useState({ PENDING: 0, SYNCING: 0, SYNCED: 0, FAILED: 0, CONFLICT: 0 });
  const [saleView, setSaleView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedOutOffline, setSignedOutOffline] = useState(false);

  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get("from");
    if (from?.startsWith("/pos/new-sale")) window.setTimeout(() => setSaleView(true), 0);
    if (from === "/logout") {
      void (async () => {
        try {
          setQueue(await getOfflineQueueSummary());
          await clearCentreOfflineData();
          setSignedOutOffline(true);
        } catch (clearError) {
          console.error("Unable to clear Centre data during offline sign-out.", clearError);
          setError("Offline sign-out could not clear all saved Centre data. Retry while connected.");
        } finally {
          setAccess(null);
          setLoading(false);
        }
      })();
      return;
    }
    void Promise.all([getCentreOfflineAccess(), getOfflineQueueSummary()])
      .then(async ([savedAccess, savedQueue]) => {
        setAccess(savedAccess);
        setQueue(savedQueue);
        if (savedAccess?.centreAuthorized) setSnapshot(await getCentreOfflineSnapshot(savedAccess.userId));
      })
      .catch((loadError) => {
        console.error("Unable to load offline Centre data.", loadError);
        setError("Saved Centre data could not be opened on this device.");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="centre-offline-page"><p>Opening offline Centre…</p></main>;

  if (!access) {
    return (
      <main className="centre-offline-page">
        <div className="centre-offline-card">
          <WifiOff aria-hidden="true" />
            <h1>{signedOutOffline ? "Centre data cleared from this device" : "This device is not ready for offline Centre"}</h1>
            <p>{signedOutOffline
              ? "Your cached Centre access and catalogue have been cleared. Pending offline sales were kept. Connect to the internet to end the server session and sync those sales."
              : "Connect to the internet and sign in to Dantown Centre on this device once. Then return here to use the saved dashboard and offline cash POS."}</p>
            {signedOutOffline && queue.PENDING + queue.SYNCING + queue.FAILED + queue.CONFLICT > 0 &&
              <p>{queue.PENDING + queue.SYNCING + queue.FAILED + queue.CONFLICT} pending sale(s) remain saved on this device.</p>}
            {error && <p role="alert">{error}</p>}
          <Link href="/centre/login">Connect and sign in</Link>
        </div>
      </main>
    );
  }

  if (saleView && access.permissions.includes("orders.create")) {
    return (
      <main className="centre-offline-page">
        <header className="centre-offline-header">
          <button type="button" onClick={() => setSaleView(false)}><ArrowLeft size={18} /> Centre offline</button>
          <span><WifiOff size={16} /> Offline cash sales · {access.staffName}</span>
        </header>
        <NewSalePage />
      </main>
    );
  }

  const pendingSales = queue.PENDING + queue.SYNCING + queue.FAILED + queue.CONFLICT;
  if (!access.centreAuthorized) {
    return (
      <main className="centre-offline-page">
        <header className="centre-offline-header">
          <div><WifiOff size={18} /><span>Offline POS</span></div>
          <span>{access.staffName} · {access.staffRole}</span>
        </header>
        <section className="centre-offline-card">
          <h1>Offline POS</h1>
          <p>This staff account can use offline POS, but Centre dashboard access has not been granted to this account.</p>
          <p>{pendingSales ? `${pendingSales} sale${pendingSales === 1 ? "" : "s"} waiting for review or sync.` : "No pending offline sales."}</p>
          {access.permissions.includes("orders.create") && <button type="button" onClick={() => setSaleView(true)}>Open offline cash POS</button>}
        </section>
      </main>
    );
  }

  return (
    <main className="centre-offline-page">
      <header className="centre-offline-header">
        <div><WifiOff size={18} /><span>Offline Centre</span></div>
        <span>{access.staffName} · {access.staffRole}</span>
      </header>
      <section className="centre-offline-card">
        <p className="eyebrow">Saved on this device</p>
        <h1>Dantown Centre</h1>
        <p>Dashboard data was last saved {snapshot ? new Date(snapshot.savedAt).toLocaleString() : "not available yet"}. Values below may be out of date until the device reconnects.</p>
        {error && <p role="alert">{error}</p>}
      </section>
      {snapshot && <section className="centre-offline-metrics" aria-label="Saved Centre metrics">
        {Object.entries(snapshot.metrics).map(([label, value]) => (
          <article className="centre-offline-card" key={label}>
            <small>{label.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}</small>
            <strong>{Number(value).toLocaleString()}</strong>
          </article>
        ))}
      </section>}
      {snapshot?.orders.length ? <section className="centre-offline-card">
        <h2>Recent orders</h2>
        <ul>{snapshot.orders.map((order) => <li key={`${order.orderNumber}-${order.createdAt}`}>
          <strong>{order.orderNumber}</strong>
          <span>KSh {order.total.toLocaleString()} · {order.paymentStatus} · {order.orderStatus}</span>
          <small>{new Date(order.createdAt).toLocaleString()}</small>
        </li>)}</ul>
      </section> : null}
      <section className="centre-offline-card">
        <h2>Offline sales</h2>
        <p>{pendingSales ? `${pendingSales} sale${pendingSales === 1 ? "" : "s"} waiting for review or sync.` : "No pending offline sales."} Pending sales are kept on this device until they can be synchronized.</p>
        {access.permissions.includes("orders.create") && <button type="button" onClick={() => setSaleView(true)}>Open offline cash POS</button>}
      </section>
      <footer><Link href="/centre/login">Sign in again when connected</Link></footer>
    </main>
  );
}
