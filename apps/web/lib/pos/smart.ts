// Smart-register helpers. Pure, SSR-safe, advisory only: nothing here changes
// what is sent to /api/pos/checkout, so pricing and stock stay server-authoritative.

export const money = (amount: number) => `Ksh ${amount.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

/** Exact amount plus the next sensible notes a customer would hand over (KES). */
export function quickCash(total: number): number[] {
  const options = new Set<number>([Math.ceil(total)]);
  for (const step of [50, 100, 500, 1000]) options.add(Math.ceil(total / step) * step);
  return [...options].filter((value) => value >= total).sort((a, b) => a - b).slice(0, 4);
}

/** "5 2.5mm cable", "5x cable", "cable x5" -> { qty, query }. Anything else is a plain search. */
export function parseSmartLine(text: string): { qty: number; query: string } {
  const value = text.trim();
  const lead = value.match(/^(\d{1,3})\s*(?:x|pcs?|of)?\s+(.+)$/i);
  if (lead) return { qty: Number(lead[1]), query: lead[2].trim() };
  const tail = value.match(/^(.+?)\s*(?:x|\*)\s*(\d{1,3})$/i);
  if (tail) return { qty: Number(tail[2]), query: tail[1].trim() };
  return { qty: 1, query: value };
}

export function whatsappUrl(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 9) return null;
  const international = digits.startsWith("254") ? digits : `254${digits.replace(/^0/, "")}`;
  return `https://wa.me/${international}?text=${encodeURIComponent(text)}`;
}

// ---- Local learning: what sells most and what sells together on this device ----
const usageKey = "dantown-pos-usage";
type Usage = { counts: Record<string, number>; pairs: Record<string, number> };
const emptyUsage = (): Usage => ({ counts: {}, pairs: {} });

function readUsage(): Usage {
  try { return { ...emptyUsage(), ...(JSON.parse(localStorage.getItem(usageKey) ?? "null") ?? {}) }; } catch { return emptyUsage(); }
}

export function recordSale(productIds: string[]) {
  try {
    const usage = readUsage();
    const ids = [...new Set(productIds)];
    ids.forEach((id) => { usage.counts[id] = (usage.counts[id] ?? 0) + 1; });
    ids.forEach((a) => ids.forEach((b) => { if (a !== b) usage.pairs[`${a}|${b}`] = (usage.pairs[`${a}|${b}`] ?? 0) + 1; }));
    const trimmed = Object.entries(usage.pairs).sort((x, y) => y[1] - x[1]).slice(0, 600);
    localStorage.setItem(usageKey, JSON.stringify({ counts: usage.counts, pairs: Object.fromEntries(trimmed) }));
  } catch { /* storage unavailable: smart hints simply stay empty */ }
}

export function topPicks(limit = 8): string[] {
  return Object.entries(readUsage().counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
}

export function boughtTogether(cartIds: string[], limit = 4): string[] {
  if (!cartIds.length) return [];
  const { pairs } = readUsage();
  const score = new Map<string, number>();
  for (const [key, count] of Object.entries(pairs)) {
    const [a, b] = key.split("|");
    if (cartIds.includes(a) && !cartIds.includes(b)) score.set(b, (score.get(b) ?? 0) + count);
  }
  return [...score.entries()].sort((x, y) => y[1] - x[1]).slice(0, limit).map(([id]) => id);
}

// ---- Held (parked) sales ----
const heldKey = "dantown-pos-held";
export type HeldSale<T> = { id: string; label: string; at: string; cart: T[]; customerName: string; customerId: string | null };

export function readHeld<T>(): HeldSale<T>[] {
  try { return JSON.parse(localStorage.getItem(heldKey) ?? "[]") as HeldSale<T>[]; } catch { return []; }
}
export function writeHeld<T>(sales: HeldSale<T>[]) {
  try { localStorage.setItem(heldKey, JSON.stringify(sales.slice(0, 10))); } catch { /* ignore */ }
}
