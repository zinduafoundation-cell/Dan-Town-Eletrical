"use client";

import { FormEvent, useState } from "react";
import { ClipboardPlus } from "lucide-react";

type Option = { id: string; name: string };
export function PurchaseWorkspace({ suppliers, warehouses, products }: { suppliers: Option[]; warehouses: Option[]; products: Option[] }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/purchases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplierId: form.get("supplierId"), warehouseId: form.get("warehouseId"), productId: form.get("productId"), quantity: Number(form.get("quantity")), unitCost: Number(form.get("unitCost")), tax: Number(form.get("tax")) || 0 }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to create purchase");
      setMessage(`${result.data.order_number} created as a draft. Inventory remains unchanged until receiving is confirmed.`); event.currentTarget.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create purchase."); } finally { setSaving(false); }
  }
  return <section className="purchase-workspace"><div className="catalog-form-icon"><ClipboardPlus size={20} /></div><p className="eyebrow">Purchase workspace</p><h2>Create a purchase draft.</h2><p>Draft purchasing stays separate from inventory. Receiving must be confirmed before stock changes.</p>{message && <div className="catalog-manager-message" role="status">{message}</div>}<form onSubmit={submit} className="purchase-form"><label>Supplier<select name="supplierId" required><option value="">Select supplier</option>{suppliers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Warehouse<select name="warehouseId" required><option value="">Select warehouse</option>{warehouses.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Product<select name="productId" required><option value="">Select product</option>{products.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Quantity<input name="quantity" type="number" min="1" required /></label><label>Unit cost<input name="unitCost" type="number" min="0" step="0.01" required /></label><label>Tax / VAT<input name="tax" type="number" min="0" step="0.01" defaultValue="0" /></label><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Creating..." : "Create draft purchase"}</button></form></section>;
}
