"use client";

import { FormEvent, useState } from "react";
import { ScanLine } from "lucide-react";

type Product = { id: string; name: string; sku: string; barcode?: string | null; retail_price: number; category_id?: string | null; brand_id?: string | null };

export function ProductBarcodeManager({ products }: { products: Product[] }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [barcode, setBarcode] = useState(products[0]?.barcode ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const selected = products.find((product) => product.id === productId);

  function selectProduct(id: string) {
    const product = products.find((item) => item.id === id);
    setProductId(id);
    setBarcode(product?.barcode ?? "");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/catalog", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: selected.id, name: selected.name, sku: selected.sku, barcode: barcode.trim() || null, retailPrice: selected.retail_price, categoryId: selected.category_id ?? null, brandId: selected.brand_id ?? null }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save barcode.");
      setMessage("Barcode saved for POS scanning.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save barcode."); }
    finally { setSaving(false); }
  }

  return <section className="barcode-manager"><div><span className="catalog-form-icon"><ScanLine size={19} /></span><p className="eyebrow">POS data</p><h2>Maintain product barcodes.</h2><p>Assign or replace a barcode for an existing catalog product. Hardware and camera scanners use this value.</p></div>{products.length ? <form className="barcode-form" onSubmit={submit}><label>Product<select value={productId} onChange={(event) => selectProduct(event.target.value)}>{products.map((product) => <option value={product.id} key={product.id}>{product.name} · {product.sku}</option>)}</select></label><label>Barcode<input value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Scan or enter barcode" /></label><button className="button button-primary" disabled={saving}>{saving ? "Saving..." : "Save barcode"}</button></form> : <div className="empty-state"><h3>No products available.</h3><p>Add a product before assigning a barcode.</p></div>}{message && <p className="barcode-message" role="status">{message}</p>}</section>;
}
