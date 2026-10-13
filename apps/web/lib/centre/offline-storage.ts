import type { Permission } from "@dantown/shared";

export type CentreOfflineAccess = {
  userId: string;
  staffName: string;
  staffRole: string;
  permissions: Permission[];
  centreAuthorized: boolean;
  savedAt: string;
};

export type CentreOfflineOrder = {
  orderNumber: string;
  total: number;
  paymentStatus: string;
  orderStatus: string;
  salesChannel: string;
  createdAt: string;
};

export type CentreOfflineSnapshot = {
  userId: string;
  savedAt: string;
  metrics: Record<string, number>;
  orders: CentreOfflineOrder[];
};

export type OfflinePOSProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  price: number;
  vatRate: number;
  category: string;
  qty: number;
  imageUrl: string | null;
};

type CacheRecord<T> = { key: string; savedAt: string; value: T };
type ProductCatalogue = { products: OfflinePOSProduct[]; count: number; complete: boolean };

const DATABASE_NAME = "dantown-centre-offline";
const DATABASE_VERSION = 1;
const STORE_NAME = "cache";
const ACCESS_KEY = "access";
const SNAPSHOT_KEY = "snapshot";
const CATALOGUE_KEY = "pos-catalogue";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open the offline Centre cache."));
  });
}

async function writeRecord<T>(key: string, value: T) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .put({ key, savedAt: new Date().toISOString(), value } satisfies CacheRecord<T>);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Unable to save offline Centre data."));
    });
  } finally {
    database.close();
  }
}

async function readRecord<T>(key: string) {
  const database = await openDatabase();
  try {
    return await new Promise<CacheRecord<T> | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as CacheRecord<T> | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Unable to read offline Centre data."));
    });
  } finally {
    database.close();
  }
}

export async function saveCentreOfflineAccess(
  access: Omit<CentreOfflineAccess, "savedAt">,
) {
  if (!access.userId || access.userId === "dev-bypass-user") return;
  await writeRecord(ACCESS_KEY, { ...access, savedAt: new Date().toISOString() });
  window.dispatchEvent(new Event("dantown-centre-access-updated"));
}

export async function getCentreOfflineAccess() {
  return (await readRecord<CentreOfflineAccess>(ACCESS_KEY))?.value ?? null;
}

export async function saveCentreOfflineSnapshot(snapshot: CentreOfflineSnapshot) {
  await writeRecord(SNAPSHOT_KEY, snapshot);
}

export async function getCentreOfflineSnapshot(userId: string) {
  const snapshot = (await readRecord<CentreOfflineSnapshot>(SNAPSHOT_KEY))?.value;
  return snapshot?.userId === userId ? snapshot : null;
}

export async function saveOfflinePOSProducts(
  products: OfflinePOSProduct[],
  count: number,
  complete: boolean,
) {
  await writeRecord<ProductCatalogue>(CATALOGUE_KEY, { products, count, complete });
}

export async function getOfflinePOSProducts() {
  const record = await readRecord<ProductCatalogue>(CATALOGUE_KEY);
  return record ? { ...record.value, savedAt: record.savedAt } : null;
}

export async function clearCentreOfflineData() {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Unable to clear cached Centre data."));
    });
  } finally {
    database.close();
  }
}
