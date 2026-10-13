"use client";

import { useState, type FormEvent } from "react";
import { BusinessReceipt } from "@/components/documents/business-receipt";
import type { BusinessDocumentSettings } from "@/lib/documents/business-document-settings";

const sampleLines = [
  { name: "1.5mm twin and earth cable", sku: "CABLE-15", quantity: 2, total: 1800 },
  { name: "LED security light", sku: "LED-20W", quantity: 1, total: 1250 },
];

export function BusinessDocumentSettingsEditor({
  initialSettings,
  migrationReady,
}: {
  initialSettings: BusinessDocumentSettings;
  migrationReady: boolean;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function update<K extends keyof BusinessDocumentSettings>(key: K, value: BusinessDocumentSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/document-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save document settings.");
      setMessage("Invoice and receipt template saved.");
    } catch (error) {
      console.error("Unable to save the invoice and receipt template.", error);
      setMessage(error instanceof Error ? error.message : "Unable to save document settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="business-document-editor">
      <form className="business-document-form" onSubmit={save}>
        <section>
          <h2>Business details</h2>
          <label>Business name<input value={settings.businessName} maxLength={100} required onChange={(event) => update("businessName", event.target.value)} /></label>
          <label>Address<input value={settings.address} maxLength={200} onChange={(event) => update("address", event.target.value)} /></label>
          <label>Phone<input value={settings.phone} maxLength={40} onChange={(event) => update("phone", event.target.value)} /></label>
          <label>Email<input type="email" value={settings.email} maxLength={254} onChange={(event) => update("email", event.target.value)} /></label>
          <label>Logo URL (HTTPS)<input type="url" value={settings.logoUrl} maxLength={500} onChange={(event) => update("logoUrl", event.target.value)} placeholder="https://…" /></label>
        </section>
        <section>
          <h2>Receipt appearance</h2>
          <label>Accent color<div className="business-document-color"><input type="color" value={settings.accentColor} onChange={(event) => update("accentColor", event.target.value)} /><input value={settings.accentColor} maxLength={7} onChange={(event) => update("accentColor", event.target.value)} /></div></label>
          <label>Footer note<textarea value={settings.footer} maxLength={300} rows={3} onChange={(event) => update("footer", event.target.value)} /></label>
          <div className="business-document-toggles">
            <label><input type="checkbox" checked={settings.showCustomer} onChange={(event) => update("showCustomer", event.target.checked)} /> Show customer</label>
            <label><input type="checkbox" checked={settings.showItemSkus} onChange={(event) => update("showItemSkus", event.target.checked)} /> Show product SKUs</label>
            <label><input type="checkbox" checked={settings.showTax} onChange={(event) => update("showTax", event.target.checked)} /> Show VAT / tax</label>
            <label><input type="checkbox" checked={settings.showPaymentMethod} onChange={(event) => update("showPaymentMethod", event.target.checked)} /> Show payment method</label>
          </div>
        </section>
        <div className="business-document-save">
          <p role="status">{message || (migrationReady ? "The same layout is used on printed POS and customer receipts." : "Database migration is not yet applied; settings cannot be saved until it is.")}</p>
          <button className="button button-primary" type="submit" disabled={saving || !migrationReady}>{saving ? "Saving…" : "Save template"}</button>
        </div>
      </form>
      <div className="business-document-preview">
        <p className="eyebrow">Live preview</p>
        <BusinessReceipt settings={settings} title="Receipt / Invoice" reference="DT-SAMPLE-001" date="12 Oct 2026, 10:30 AM" customer="Sample Customer" paymentMethod="M-Pesa" lines={sampleLines} subtotal={3050} tax={0} delivery={0} total={3050} />
      </div>
    </div>
  );
}
