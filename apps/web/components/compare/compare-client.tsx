"use client";

import Link from "next/link";
import { Check, Copy, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCompare } from "@/lib/compare";
import { formatCurrency } from "@/lib/store-data";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";

type Item = {
  id: string; slug: string; sku: string; name: string; summary: string | null; price: number; previousPrice: number | null;
  category: string | null; brand: string | null; image: string | null; availability: "In stock" | "Low stock" | "Out of stock"; specs: Record<string, string>;
};

export function CompareClient({ initialSlugs }: { initialSlugs: string[] }) {
  const { slugs, remove, clear } = useCompare();
  const [items, setItems] = useState<Item[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [copied, setCopied] = useState(false);

  // A shared link (?items=a,b) seeds the list once; after that the shopper's own list leads.
  useEffect(() => {
    if (!initialSlugs.length) return;
    try {
      if (!JSON.parse(window.localStorage.getItem("dantown-compare") ?? "[]").length) {
        window.localStorage.setItem("dantown-compare", JSON.stringify(initialSlugs.slice(0, 4)));
        window.dispatchEvent(new Event("dantown:compare-changed"));
      }
    } catch { /* ignore */ }
  }, [initialSlugs]);

  const active = slugs.length ? slugs : initialSlugs;
  const key = active.join(",");
  const loading = Boolean(key) && loadedKey !== key;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    fetch(`/api/catalog/compare?slugs=${encodeURIComponent(key)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { products: [] }))
      .then((result: { products: Item[] }) => {
        if (!cancelled) {
          setItems(result.products);
          setLoadedKey(key);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoadedKey(key);
        }
      });
    return () => { cancelled = true; };
  }, [key]);

  const specNames = useMemo(() => Array.from(new Set(items.flatMap((item) => Object.keys(item.specs)))), [items]);
  const cheapest = items.length > 1 ? Math.min(...items.map((item) => item.price)) : null;

  const rows: Array<{ label: string; values: string[]; best?: (value: string, index: number) => boolean }> = [
    { label: "Price", values: items.map((item) => formatCurrency(item.price)), best: (_v, i) => items[i].price === cheapest },
    { label: "Availability", values: items.map((item) => item.availability), best: (v) => v === "In stock" },
    { label: "Brand", values: items.map((item) => item.brand ?? "—") },
    { label: "Category", values: items.map((item) => item.category ?? "—") },
    { label: "SKU", values: items.map((item) => item.sku) },
    ...specNames.map((name) => ({ label: name, values: items.map((item) => item.specs[name] ?? "—") })),
  ];
  const visibleRows = onlyDifferences ? rows.filter((row) => new Set(row.values).size > 1) : rows;

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/compare?items=${encodeURIComponent(key)}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (loading && key) return <p className="empty-state">Loading your comparison…</p>;
  if (!key || items.length < 2) {
    return (
      <div className="empty-state">
        <h2>Pick at least two products</h2>
        <p>Tap <strong>Compare</strong> on any product in the shop to line them up side by side.</p>
        <Link className="button button-primary" href="/shop">Browse the shop</Link>
      </div>
    );
  }

  return (
    <div className="compare-wrap">
      <div className="compare-toolbar">
        <label><input type="checkbox" checked={onlyDifferences} onChange={(event) => setOnlyDifferences(event.target.checked)} /> Show only differences</label>
        <button type="button" className="button button-quiet" onClick={copyLink}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Link copied" : "Share this comparison"}</button>
        <button type="button" className="button button-quiet" onClick={clear}>Clear all</button>
      </div>
      <div className="compare-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Feature</span></th>
              {items.map((item) => (
                <th scope="col" key={item.id}>
                  <button type="button" className="compare-remove" onClick={() => remove(item.slug)} aria-label={`Remove ${item.name}`}><X size={14} /></button>
                  <div className="compare-image" style={item.image ? { backgroundImage: `url(${item.image})` } : undefined} aria-hidden="true" />
                  <Link href={`/products/${item.slug}`}>{item.name}</Link>
                  {cheapest !== null && item.price === cheapest && <span className="compare-badge"><Trophy size={12} /> Lowest price</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.values.map((value, index) => (
                  <td key={`${row.label}-${index}`} className={row.best?.(value, index) ? "is-best" : undefined}>{value}</td>
                ))}
              </tr>
            ))}
            {!visibleRows.length && <tr><td colSpan={items.length + 1}>These products have identical details.</td></tr>}
            <tr>
              <th scope="row">Order</th>
              {items.map((item) => (
                <td key={item.id}>
                  <AddToCartButton
                    product={{ id: item.id, slug: item.slug, name: item.name, sku: item.sku, retail_price: item.price, primary_image: item.image, featured: false }}
                    stockStatus={item.availability}
                    showText
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
