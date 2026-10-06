export type HeldSaleItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
};

export type HeldSale = {
  id: string;
  customerName: string;
  cart: HeldSaleItem[];
  subtotal: number;
  vat: number;
  total: number;
  createdAt: string;
  updatedAt: string;
};

export const HELD_SALES_STORAGE_KEY = "dantown-pos-held-sales";

export function createHeldSale(payload: Partial<HeldSale> & {
  id: string;
  customerName: string;
  cart: HeldSaleItem[];
  subtotal: number;
  vat: number;
  total: number;
  createdAt: string;
}): HeldSale {
  const created = payload.createdAt || new Date().toISOString();
  return {
    id: payload.id,
    customerName: payload.customerName,
    cart: payload.cart,
    subtotal: Number(payload.subtotal || 0),
    vat: Number(payload.vat || 0),
    total: Number(payload.total || 0),
    createdAt: created,
    updatedAt: payload.updatedAt || created
  };
}

export function getHeldSales(storage?: Map<string, string> | Storage): HeldSale[] {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!target) return [];

  const raw = target instanceof Map ? target.get(HELD_SALES_STORAGE_KEY) : target.getItem(HELD_SALES_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as HeldSale[];
    return Array.isArray(parsed) ? parsed.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) : [];
  } catch {
    return [];
  }
}

export function upsertHeldSale(sale: HeldSale, storage?: Map<string, string> | Storage): HeldSale[] {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  const current = getHeldSales(target);
  const next = [sale, ...current.filter((entry) => entry.id !== sale.id)].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 10);

  if (target) {
    if (target instanceof Map) {
      target.set(HELD_SALES_STORAGE_KEY, JSON.stringify(next));
    } else {
      target.setItem(HELD_SALES_STORAGE_KEY, JSON.stringify(next));
    }
  }

  return next;
}

export function removeHeldSale(id: string, storage?: Map<string, string> | Storage): HeldSale[] {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  const current = getHeldSales(target);
  const next = current.filter((entry) => entry.id !== id);

  if (target) {
    if (target instanceof Map) {
      target.set(HELD_SALES_STORAGE_KEY, JSON.stringify(next));
    } else {
      target.setItem(HELD_SALES_STORAGE_KEY, JSON.stringify(next));
    }
  }

  return next;
}
