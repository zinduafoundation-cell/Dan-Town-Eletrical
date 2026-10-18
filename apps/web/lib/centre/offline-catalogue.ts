import { saveOfflinePOSProducts, type OfflinePOSProduct } from "@/lib/centre/offline-storage";

type ProductResponse = { success: boolean; data?: OfflinePOSProduct[]; count?: number | null; error?: string };
type NetworkConnection = { type?: string };

export function isWifiConnection() {
  if (typeof navigator === "undefined") return false;
  return (navigator as Navigator & { connection?: NetworkConnection }).connection?.type === "wifi";
}

export async function downloadOfflinePOSCatalogue(onProgress: (message: string) => void = () => {}) {
  if (typeof navigator === "undefined" || !navigator.onLine) {
    throw new Error("Connect to the internet before downloading the product catalogue.");
  }

  const firstResponse = await fetch("/api/pos/products?limit=100&page=1", { cache: "no-store" });
  const first = (await firstResponse.json()) as ProductResponse;
  if (!firstResponse.ok || !first.success || !Array.isArray(first.data)) {
    throw new Error(first.error ?? "The product catalogue could not be downloaded.");
  }

  const products = [...first.data];
  const reportedCount = Number(first.count ?? products.length);
  const count = Number.isFinite(reportedCount) && reportedCount > 0 ? reportedCount : products.length;
  const pageCount = Math.max(1, Math.ceil(count / 100));
  onProgress(`Downloading products: ${products.length} of ${count}`);

  for (let page = 2; page <= pageCount; page += 1) {
    const response = await fetch(`/api/pos/products?limit=100&page=${page}`, { cache: "no-store" });
    const result = (await response.json()) as ProductResponse;
    if (!response.ok || !result.success || !Array.isArray(result.data)) {
      throw new Error(result.error ?? `Product catalogue download stopped at page ${page}.`);
    }
    products.push(...result.data);
    onProgress(`Downloading products: ${products.length} of ${count}`);
  }

  if (count > 0 && products.length < count) {
    throw new Error(`Only ${products.length} of ${count} products were downloaded. Try again while online.`);
  }

  await saveOfflinePOSProducts(products, count, true);
  return count;
}
