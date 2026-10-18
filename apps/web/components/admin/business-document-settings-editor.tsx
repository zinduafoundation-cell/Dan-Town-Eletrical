"use client";

import { useState, type FormEvent } from "react";
import { defaultBusinessDocumentSettings, type BusinessDocumentSettings } from "@/lib/documents/business-document-settings";
import { businessDocumentTypes } from "@/lib/documents/business-document-types";

const businessDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export function BusinessDocumentSettingsEditor({
  initialSettings,
  initialUpdatedAt,
  migrationReady,
  initialMessage = "",
}: {
  initialSettings: BusinessDocumentSettings;
  initialUpdatedAt: string | null;
  migrationReady: boolean;
  initialMessage?: string;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [prefixSearch, setPrefixSearch] = useState("");
  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

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
      const result = await response.json() as { error?: string; updatedAt?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save document settings.");
      setSavedSettings(settings);
      if (result.updatedAt) setUpdatedAt(result.updatedAt);
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
          <label>Document numbering code<input value={settings.businessCode} maxLength={8} required onChange={(event) => update("businessCode", event.target.value.toUpperCase())} /><small>Used on database-issued unique document numbers.</small></label>
          <label>Financial year starts<select value={settings.financialYearStartMonth} onChange={(event) => update("financialYearStartMonth", Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{new Date(2026, month - 1, 1).toLocaleString("en", { month: "long" })}</option>)}</select></label>
          <label>Country<input value={settings.country} maxLength={80} onChange={(event) => update("country", event.target.value)} /></label>
          <label>Branch name (optional)<input value={settings.branchName} maxLength={100} onChange={(event) => update("branchName", event.target.value)} /></label>
          <label>Business registration number (optional)<input value={settings.registrationNumber} maxLength={80} onChange={(event) => update("registrationNumber", event.target.value)} /></label>
          <fieldset className="business-opening-hours">
            <legend>Public opening hours</legend>
            {businessDays.map((day) => {
              const hours = settings.openingHours[day];
              return <div key={day}>
                <strong>{day[0].toUpperCase() + day.slice(1)}</strong>
                <label><span className="sr-only">{day} opens</span><input type="time" value={hours.open} disabled={hours.closed} onChange={(event) => setSettings((current) => ({ ...current, openingHours: { ...current.openingHours, [day]: { ...hours, open: event.target.value } } }))} /></label>
                <label><span className="sr-only">{day} closes</span><input type="time" value={hours.close} disabled={hours.closed} onChange={(event) => setSettings((current) => ({ ...current, openingHours: { ...current.openingHours, [day]: { ...hours, close: event.target.value } } }))} /></label>
                <label><input type="checkbox" checked={hours.closed} onChange={(event) => setSettings((current) => ({ ...current, openingHours: { ...current.openingHours, [day]: { ...hours, closed: event.target.checked } } }))} /> Closed</label>
              </div>;
            })}
          </fieldset>
          <label>Business timezone<select value={settings.timeZone} onChange={(event) => update("timeZone", event.target.value)}>{[...new Set([settings.timeZone, "Africa/Nairobi", "Africa/Dar_es_Salaam", "Africa/Kampala", "UTC", "Europe/London", "America/New_York"])].map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></label>
          <label>Date format<select value={settings.dateLocale} onChange={(event) => update("dateLocale", event.target.value as BusinessDocumentSettings["dateLocale"])}><option value="en-KE">Kenya (e.g. 18 Oct 2026)</option><option value="en-GB">United Kingdom (e.g. 18 Oct 2026)</option><option value="en-US">United States (e.g. Oct 18, 2026)</option></select></label>
          <label>Currency<input value="KES — Kenyan shillings" readOnly /><small>Transactions are KES-only in the current database schema.</small></label>
          <label>Address<input value={settings.address} maxLength={200} onChange={(event) => update("address", event.target.value)} /></label>
          <label>Phone<input value={settings.phone} maxLength={40} onChange={(event) => update("phone", event.target.value)} /></label>
          <label>Email<input type="email" value={settings.email} maxLength={254} onChange={(event) => update("email", event.target.value)} /></label>
          <label>Logo URL (HTTPS)<input type="url" value={settings.logoUrl} maxLength={500} onChange={(event) => update("logoUrl", event.target.value)} placeholder="https://…" /></label>
          <label>KRA PIN (optional)<input value={settings.kraPin} maxLength={24} onChange={(event) => update("kraPin", event.target.value)} /></label>
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
        <section className="business-document-prefixes">
          <h2>Document number prefixes</h2>
          <p>Prefixes are unique and feed the database-issued number. Leave the system defaults unchanged unless your business uses another format.</p>
          <label>Find a document type<input value={prefixSearch} onChange={(event) => setPrefixSearch(event.target.value)} placeholder="Search invoices, delivery notes..." /></label>
          <div>{businessDocumentTypes.filter((documentType) => !prefixSearch || documentType.label.toLowerCase().includes(prefixSearch.toLowerCase())).map((documentType) => (
            <label key={documentType.value}>{documentType.label}<input
              value={settings.documentPrefixes[documentType.value] ?? ""}
              maxLength={8}
              pattern="[A-Za-z0-9]{1,8}"
              onChange={(event) => setSettings((current) => ({
                ...current,
                documentPrefixes: { ...current.documentPrefixes, [documentType.value]: event.target.value.toUpperCase() || defaultBusinessDocumentSettings.documentPrefixes[documentType.value] },
              }))}
            /></label>
          ))}</div>
        </section>
        <div className="business-document-save">
          <p role="status">{message || (updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString(settings.dateLocale, { timeZone: settings.timeZone })}.` : migrationReady ? "No saved settings yet. Save to persist the shared profile and print configuration." : "Database migration is not yet applied; settings cannot be saved until it is.")}</p>
          <div>
            <button className="button button-secondary" type="button" disabled={saving || !isDirty} onClick={() => { setSettings(savedSettings); setMessage("Unsaved changes cancelled."); }}>Cancel</button>
            <button className="button button-secondary" type="button" disabled={saving || !migrationReady} onClick={() => {
              if (!window.confirm("Load the default document settings? They will not be saved until you choose Save.")) return;
              setSettings(defaultBusinessDocumentSettings);
              setMessage("Defaults loaded. Save to apply them.");
            }}>Reset</button>
            <button className="button button-primary" type="submit" disabled={saving || !migrationReady || !isDirty}>{saving ? "Saving…" : "Save template"}</button>
          </div>
        </div>
      </form>
      <div className="business-document-preview"><p className="eyebrow">Document desk</p><h2>Live business records only</h2><p>Saved invoices, delivery notes, and other business records are created and printed in Business Documents. This settings page only controls the shared business identity and print layout.</p></div>
    </div>
  );
}
