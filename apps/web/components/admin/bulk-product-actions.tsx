"use client";

import { useState } from "react";
import { CheckSquare, Layers, Send } from "lucide-react";

type Product = { id: string; name: string; sku: string; status: string; is_active: boolean };
type Category = { id: string; name: string; parent_id: string | null };
type Brand = { id: string; name: string };

export function BulkProductActions({ products, categories, brands }: { products: Product[]; categories: Category[]; brands: Brand[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState("publish");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const allSelected = products.length > 0 && selected.length === products.length;

  function toggleAll() { setSelected(allSelected ? [] : products.map((product) => product.id)); }
  function toggleProduct(id: string) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  async function applyBulkAction() {
    if (!selected.length) return setMessage("Select at least one product first.");
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/catalog/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productIds: selected, action, value: ["category", "brand"].includes(action) ? value : null }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Bulk action failed");
      setMessage(`${result.updated} product${result.updated === 1 ? "" : "s"} updated. Refresh to see the latest state.`);
      setSelected([]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Bulk action failed."); }
    finally { setSaving(false); }
  }

  return <section className="bulk-product-actions"><div className="section-heading"><div><p className="eyebrow">Catalog operations</p><h2>Bulk product management</h2></div><span>{selected.length} selected</span></div><div className="bulk-product-toolbar"><button type="button" className="button button-quiet" onClick={toggleAll}><CheckSquare size={16} /> {allSelected ? "Clear all" : "Select all"}</button><select value={action} onChange={(event) => { setAction(event.target.value); setValue(""); }} aria-label="Bulk action"><option value="publish">Publish website</option><option value="unpublish">Unpublish website</option><option value="enable-pos">Enable POS</option><option value="disable-pos">Disable POS</option><option value="archive">Archive safely</option><option value="category">Change category</option><option value="brand">Change brand</option></select>{action === "category" && <select value={value} onChange={(event) => setValue(event.target.value)} aria-label="New category"><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.parent_id ? `↳ ${category.name}` : category.name}</option>)}</select>}{action === "brand" && <select value={value} onChange={(event) => setValue(event.target.value)} aria-label="New brand"><option value="">Choose brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>}<button type="button" className="button button-primary" disabled={saving} onClick={applyBulkAction}><Send size={16} /> {saving ? "Applying..." : "Apply action"}</button></div>{message && <p className="bulk-product-message" role="status">{message}</p>}<div className="bulk-product-list">{products.map((product) => <label key={product.id}><input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggleProduct(product.id)} /><span><strong>{product.name}</strong><small>{product.sku} · {product.status} · POS {product.is_active ? "enabled" : "disabled"}</small></span><Layers size={15} /></label>)}</div></section>;
}
