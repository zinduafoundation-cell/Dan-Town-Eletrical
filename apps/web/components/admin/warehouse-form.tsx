"use client";

import { FormEvent, useState } from "react";
import { Warehouse as WarehouseIcon } from "lucide-react";

type Warehouse = { id: string; name: string; code?: string; location?: string | null };

export function WarehouseForm({ initialWarehouses, canManage }: { initialWarehouses: Warehouse[]; canManage: boolean }) {
  const [warehouses, setWarehouses] = useState(initialWarehouses);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/inventory/warehouses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), code: form.get("code"), location: form.get("location") || null, description: form.get("description") || null }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create warehouse.");
      setWarehouses((current) => [...current, result.data]);
      setMessage("Warehouse created.");
      event.currentTarget.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create warehouse."); }
    finally { setSaving(false); }
  }

  return <section className="warehouse-manager"><div className="warehouse-manager-heading"><div><span className="catalog-form-icon"><WarehouseIcon size={19} /></span><p className="eyebrow">Storage network</p><h2>Warehouses and store locations</h2></div><span>{warehouses.length} active</span></div>{canManage && <form className="warehouse-form" onSubmit={submit}><label>Name<input name="name" required placeholder="Kitale Main Store" /></label><label>Code<input name="code" required pattern="[A-Za-z0-9_-]+" placeholder="KIT-MAIN" /></label><label>Location<input name="location" placeholder="Kitale CBD" /></label><label>Description<input name="description" placeholder="Primary retail and receiving store" /></label><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Creating..." : "Add warehouse"}</button></form>}{message && <p className="warehouse-message" role="status">{message}</p>}<div className="warehouse-list">{warehouses.map((warehouse) => <div className="warehouse-row" key={warehouse.id}><strong>{warehouse.name}</strong><span>{warehouse.code || "No code"} · {warehouse.location || "Location not set"}</span></div>)}</div></section>;
}
