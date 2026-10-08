/* eslint-disable @next/next/no-img-element -- Inventory images are administrator-supplied remote URLs and need to remain usable without a restrictive build-time host allowlist. */
"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Search, X } from "lucide-react";
import { fetchWithBiometric } from "@/lib/auth/passkey-client";

type InventoryRow = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
  category: string;
  brand: string;
  imageUrl: string | null;
  warehouseId: string;
  warehouse: string;
  quantity: number;
  reserved: number;
  reorderLevel: number;
  costPrice: number;
  retailPrice: number;
  status: string;
  tracked: boolean;
  published: boolean;
  posAvailable: boolean;
};

type Warehouse = { id: string; name: string };

type Props = { rows: InventoryRow[]; warehouses: Warehouse[]; canAdjust: boolean; canTransfer: boolean; initialQuery?: string };
type StockFilter = "all" | "in-stock" | "low-stock" | "out-of-stock" | "reserved" | "not-tracked" | "draft" | "published" | "pos";

export function InventoryWorkspace({ rows: initialRows, warehouses, canAdjust, canTransfer, initialQuery = "" }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<StockFilter>("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferProductId, setTransferProductId] = useState("");
  const [transferSourceId, setTransferSourceId] = useState("");
  const [transferDestinationId, setTransferDestinationId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState(1);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const available = row.quantity - row.reserved;
      const matchesQuery = !normalized || [row.name, row.sku, row.barcode, row.category, row.brand, row.warehouse].some((value) => value?.toLowerCase().includes(normalized));
      const matchesWarehouse = warehouseFilter === "all" || row.warehouseId === warehouseFilter;
      const matchesFilter = filter === "all" ||
        (filter === "in-stock" && available > row.reorderLevel) ||
        (filter === "low-stock" && available > 0 && available <= row.reorderLevel) ||
        (filter === "out-of-stock" && row.tracked && available === 0) ||
        (filter === "reserved" && row.reserved > 0) ||
        (filter === "not-tracked" && !row.tracked) ||
        (filter === "draft" && row.status === "DRAFT") ||
        (filter === "published" && row.published) ||
        (filter === "pos" && row.posAvailable);
      return matchesQuery && matchesWarehouse && matchesFilter;
    });
  }, [filter, query, rows, warehouseFilter]);

  async function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || delta === 0 || !reason.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetchWithBiometric("/api/admin/inventory/adjust", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: selected.productId, warehouseId: selected.warehouseId, delta, reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to adjust stock");
      setRows((current) => current.map((row) => row.id === selected.id ? { ...row, quantity: row.quantity + delta } : row));
      setMessage(`Stock updated for ${selected.name}.`);
      setSelected(null);
      setReason("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to adjust stock.");
    } finally {
      setSaving(false);
    }
  }

  async function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transferProductId || !transferSourceId || !transferDestinationId || transferSourceId === transferDestinationId || transferQuantity <= 0) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/inventory/transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: transferProductId, sourceWarehouseId: transferSourceId, destinationWarehouseId: transferDestinationId, quantity: transferQuantity, referenceId: crypto.randomUUID() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to transfer stock");
      setRows((current) => current.map((row) => row.productId !== transferProductId ? row : row.warehouseId === transferSourceId ? { ...row, quantity: row.quantity - transferQuantity } : row.warehouseId === transferDestinationId ? { ...row, quantity: row.quantity + transferQuantity } : row));
      setMessage("Warehouse transfer completed and recorded.");
      setTransferOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to transfer stock.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="inventory-workspace">
    <div className="inventory-toolbar">
      <label className="inventory-search"><Search size={17} /><span className="sr-only">Search inventory</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, SKU, barcode, supplier, brand, category..." /></label>
      <select value={filter} onChange={(event) => setFilter(event.target.value as StockFilter)} aria-label="Inventory status"><option value="all">All products</option><option value="in-stock">In stock</option><option value="low-stock">Low stock</option><option value="out-of-stock">Out of stock</option><option value="reserved">Reserved stock</option><option value="not-tracked">Not tracked in a warehouse</option><option value="published">Website published</option><option value="pos">POS available</option><option value="draft">Draft</option></select>
      <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)} aria-label="Warehouse"><option value="all">All warehouses</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select>
      {canTransfer && <button type="button" className="button button-secondary inventory-transfer-trigger" onClick={() => setTransferOpen(true)}><ArrowLeftRight size={15} /> Transfer stock</button>}
    </div>
    {message && <div className="catalog-manager-message" role="status">{message}</div>}
    <div className="inventory-results-summary" aria-live="polite">Showing {filteredRows.length.toLocaleString()} product and warehouse records</div>
    <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Photo</th><th>Product</th><th>SKU / barcode</th><th>Category / brand</th><th>Warehouse</th><th>Buying</th><th>Selling</th><th>Stock</th><th>Available</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredRows.length ? filteredRows.map((row) => { const available = row.quantity - row.reserved; return <tr key={row.id}><td>{row.imageUrl ? <img className="inventory-product-image" src={row.imageUrl} alt={`${row.name} product photo`} loading="lazy" /> : <span className="inventory-product-image inventory-product-image-empty" aria-label="No product image">—</span>}</td><td><strong>{row.name}</strong><small>{row.published ? "Website published" : "Website draft"}</small></td><td>{row.sku}<small>{row.barcode || "No barcode"}</small></td><td>{row.category}<small>{row.brand}</small></td><td>{row.warehouse}</td><td>KSh {row.costPrice.toLocaleString()}</td><td>KSh {row.retailPrice.toLocaleString()}</td><td>{row.quantity}<small>{row.reserved} reserved</small></td><td className={available <= row.reorderLevel ? "is-warning" : ""}>{available}<small>{row.tracked ? `reorder at ${row.reorderLevel}` : "no stock record"}</small></td><td>{!row.tracked ? <span className="inventory-status inventory-status-untracked">Not tracked</span> : <span className={`inventory-status inventory-status-${available === 0 ? "out" : available <= row.reorderLevel ? "low" : "ok"}`}>{available === 0 ? "Out of stock" : available <= row.reorderLevel ? "Low stock" : "In stock"}</span>}</td><td>{canAdjust && row.tracked ? <button type="button" className="button button-quiet inventory-action" onClick={() => { setSelected(row); setDelta(1); }}><ArrowUpFromLine size={15} /> Adjust</button> : !row.tracked ? <span className="inventory-not-tracked-note">Receive stock to start tracking</span> : <span className="inventory-not-tracked-note">View only</span>}</td></tr>; }) : <tr><td colSpan={11}><div className="inventory-empty">No products match this search or filter.</div></td></tr>}</tbody></table></div>
    {selected && <div className="inventory-adjust-panel"><div><p className="eyebrow">Safe stock mutation</p><h2>{selected.name}</h2><p>{selected.warehouse} · Current quantity {selected.quantity} · Reserved {selected.reserved}</p></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close adjustment panel"><X size={18} /></button><form onSubmit={submitAdjustment} className="inventory-adjust-form"><label>Change quantity<input type="number" value={delta} onChange={(event) => setDelta(Number(event.target.value))} /></label><label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Receiving, damage, count correction..." required rows={3} /></label><div className="inventory-adjust-actions"><button type="button" className="button button-quiet" onClick={() => setDelta((value) => -Math.abs(value || 1))}><ArrowDownToLine size={15} /> Remove stock</button><button type="submit" className="button button-primary" disabled={saving || delta === 0}>{saving ? "Updating..." : "Confirm adjustment"}</button></div></form></div>}
    {transferOpen && <div className="inventory-transfer-panel"><div className="inventory-transfer-heading"><div><p className="eyebrow">Atomic warehouse transfer</p><h2>Move stock between active warehouses.</h2></div><button className="icon-button" onClick={() => setTransferOpen(false)} aria-label="Close transfer panel"><X size={18} /></button></div><form onSubmit={submitTransfer} className="inventory-transfer-form"><label>Product<select value={transferProductId} onChange={(event) => setTransferProductId(event.target.value)} required><option value="">Select product</option>{Array.from(new Map(rows.map((row) => [row.productId, row])).values()).map((row) => <option key={row.productId} value={row.productId}>{row.name} · {row.sku}</option>)}</select></label><label>From warehouse<select value={transferSourceId} onChange={(event) => setTransferSourceId(event.target.value)} required><option value="">Select source</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label><label>To warehouse<select value={transferDestinationId} onChange={(event) => setTransferDestinationId(event.target.value)} required><option value="">Select destination</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label><label>Quantity<input type="number" min="1" value={transferQuantity} onChange={(event) => setTransferQuantity(Number(event.target.value))} required /></label><button type="submit" className="button button-primary" disabled={saving || transferSourceId === transferDestinationId}>{saving ? "Transferring..." : "Confirm transfer"}</button></form></div>}
  </div>;
}
