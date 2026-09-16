import { emit } from "../core/events";

export type OfflineSalePayload = { customerId: string | null; customerName: string; subtotal: number; vat: number; total: number; paymentMethod: "cash" | "card" | "mpesa" | "bank"; items: Array<{ productId: string; quantity: number }> };
export type OfflineSyncStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED" | "CONFLICT";
type QueuedSale = { id: string; deviceId: string; createdAt: string; status: OfflineSyncStatus; retryCount: number; lastError: string | null; nextAttemptAt: string | null; payload: OfflineSalePayload };
const databaseName = "dantown-pos";
const storeName = "offline-sales";

export const getRetryDelayMs = (retryCount: number) => Math.min(300_000, 2 ** Math.max(1, retryCount) * 1_000);
export const getSyncFailureStatus = (status: number, retryCount: number): OfflineSyncStatus => status === 400 || status === 401 || status === 403 || status === 409 || retryCount >= 5 ? "CONFLICT" : "FAILED";

function deviceId() {
  const key = "dantown-pos-device-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}

function openQueue() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(storeName) ? request.transaction?.objectStore(storeName) : database.createObjectStore(storeName, { keyPath: "id" });
      if (!store) return;
      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        const sale = cursor.value as Partial<QueuedSale>;
        cursor.update({ ...sale, deviceId: sale.deviceId ?? deviceId(), status: sale.status ?? "PENDING", retryCount: sale.retryCount ?? 0, lastError: sale.lastError ?? null, nextAttemptAt: sale.nextAttemptAt ?? null });
        cursor.continue();
      };
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readSales() {
  const database = await openQueue();
  try { return await new Promise<QueuedSale[]>((resolve, reject) => { const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll(); request.onsuccess = () => resolve(request.result as QueuedSale[]); request.onerror = () => reject(request.error); }); }
  finally { database.close(); }
}

async function updateSale(id: string, update: Partial<Pick<QueuedSale, "status" | "retryCount" | "lastError" | "nextAttemptAt">>) {
  const database = await openQueue();
  try { await new Promise<void>((resolve, reject) => { const store = database.transaction(storeName, "readwrite").objectStore(storeName); const request = store.get(id); request.onsuccess = () => { const sale = request.result as QueuedSale | undefined; if (!sale) return resolve(); const write = store.put({ ...sale, ...update }); write.onsuccess = () => resolve(); write.onerror = () => reject(write.error); }; request.onerror = () => reject(request.error); }); }
  finally { database.close(); }
}

async function removeSale(id: string) {
  const database = await openQueue();
  try { await new Promise<void>((resolve, reject) => { const request = database.transaction(storeName, "readwrite").objectStore(storeName).delete(id); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }); }
  finally { database.close(); }
}

export async function enqueueSale(payload: OfflineSalePayload) {
  const sale: QueuedSale = { id: crypto.randomUUID(), deviceId: deviceId(), createdAt: new Date().toISOString(), status: "PENDING", retryCount: 0, lastError: null, nextAttemptAt: null, payload };
  const database = await openQueue();
  try { await new Promise<void>((resolve, reject) => { const request = database.transaction(storeName, "readwrite").objectStore(storeName).add(sale); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }); }
  finally { database.close(); }
  emit("OFFLINE_SALE_CREATED", { transactionId: sale.id, createdAt: sale.createdAt });
  window.dispatchEvent(new Event("dantown-pos-sync"));
  return sale.id;
}

export async function getOfflineQueueSummary() {
  return (await readSales()).reduce<Record<OfflineSyncStatus, number>>((summary, sale) => { summary[sale.status] += 1; return summary; }, { PENDING: 0, SYNCING: 0, SYNCED: 0, FAILED: 0, CONFLICT: 0 });
}

export async function flushQueuedSales() {
  if (!navigator.onLine) return 0;
  let synced = 0;
  for (const sale of await readSales()) {
    if (sale.status === "SYNCED" || sale.status === "CONFLICT" || (sale.nextAttemptAt && new Date(sale.nextAttemptAt).getTime() > Date.now())) continue;
    await updateSale(sale.id, { status: "SYNCING", lastError: null, nextAttemptAt: null });
    try {
      const response = await fetch("/api/pos/checkout", { method: "POST", headers: { "Content-Type": "application/json", "X-Offline-Transaction-Id": sale.id, "X-Offline-Device-Id": sale.deviceId }, body: JSON.stringify(sale.payload) });
      const result = await response.json().catch(() => null) as { error?: string; receipt?: { orderId: string } } | null;
      if (!response.ok || !result?.receipt?.orderId) {
        const retryCount = sale.retryCount + 1;
        const status = getSyncFailureStatus(response.status, retryCount);
        const message = result?.error ?? `Sync failed with status ${response.status}`;
        await updateSale(sale.id, { status, retryCount, lastError: message, nextAttemptAt: status === "CONFLICT" ? null : new Date(Date.now() + getRetryDelayMs(retryCount)).toISOString() });
        emit("SYNC_FAILED", { transactionId: sale.id, reason: message, retryCount });
        continue;
      }
      await removeSale(sale.id);
      emit("OFFLINE_DATA_SYNCED", { transactionId: sale.id, orderId: result.receipt.orderId });
      window.dispatchEvent(new Event("dantown-pos-sync"));
      synced += 1;
    } catch (error) {
      const retryCount = sale.retryCount + 1;
      await updateSale(sale.id, { status: getSyncFailureStatus(0, retryCount), retryCount, lastError: error instanceof Error ? error.message : "Sync failed", nextAttemptAt: new Date(Date.now() + getRetryDelayMs(retryCount)).toISOString() });
    }
  }
  return synced;
}
