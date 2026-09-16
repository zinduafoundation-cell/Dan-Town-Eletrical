"use client";

import { useState } from "react";

export type KnowledgeEntryView = { id: string; title: string; category: string; content: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; updated_at: string };

export function KnowledgeManager({ initialEntries }: { initialEntries: KnowledgeEntryView[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [form, setForm] = useState({ title: "", category: "GENERAL", content: "", status: "DRAFT" as KnowledgeEntryView["status"] });
  const [message, setMessage] = useState("");

  async function saveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json() as { entry?: KnowledgeEntryView; error?: string };
    if (!response.ok || !result.entry) { setMessage(result.error || "Unable to save entry."); return; }
    setEntries((current) => [result.entry!, ...current]);
    setForm({ title: "", category: "GENERAL", content: "", status: "DRAFT" });
    setMessage("Knowledge entry saved.");
  }

  async function updateStatus(entry: KnowledgeEntryView) {
    const status = entry.status === "DRAFT" ? "PUBLISHED" : entry.status === "PUBLISHED" ? "ARCHIVED" : "DRAFT";
    const response = await fetch("/api/admin/knowledge", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...entry, status }) });
    const result = await response.json() as { entry?: KnowledgeEntryView; error?: string };
    if (!response.ok || !result.entry) { setMessage(result.error || "Unable to update entry."); return; }
    setEntries((current) => current.map((currentEntry) => currentEntry.id === entry.id ? result.entry! : currentEntry));
    setMessage(`Entry moved to ${status.toLowerCase()}.`);
  }

  return <div className="knowledge-manager"><div className="catalog-manager-grid"><form className="catalog-manager-form" onSubmit={saveEntry}><p className="eyebrow">DAN T AI source</p><h2>Add approved knowledge</h2><p>Only published entries are available to the assistant.</p>{message && <div className="catalog-manager-message">{message}</div>}<label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label>Category<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required /></label><label>Content<textarea rows={8} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required /></label><label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as KnowledgeEntryView["status"] })}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label><button className="button button-primary" type="submit">Save entry</button></form></div><section className="catalog-manager-list"><div className="section-heading"><div><p className="eyebrow">Current sources</p><h2>Knowledge entries</h2></div><strong>{entries.length} entries</strong></div><div className="catalog-product-list">{entries.length ? entries.map((entry) => <article className="catalog-product-row" key={entry.id}><div className="catalog-product-art">AI</div><div><strong>{entry.title}</strong><small>{entry.category} · Updated {new Date(entry.updated_at).toLocaleDateString()}</small></div><button type="button" onClick={() => void updateStatus(entry)} title="Move to next status"><span>{entry.status}</span></button></article>) : <p>No knowledge entries have been created.</p>}</div></section></div>;
}