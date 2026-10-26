"use client";

import Image from "next/image";
import { useState } from "react";

export type PromotionView = {
  id: string;
  title: string;
  description: string;
  badge: string;
  image_url: string | null;
  mobile_image_url: string | null;
  cta_label: string;
  show_on_homepage: boolean;
  destination_url: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

type PromotionForm = {
  title: string;
  description: string;
  badge: string;
  imageUrl: string;
  mobileImageUrl: string;
  ctaLabel: string;
  showOnHomepage: boolean;
  destinationUrl: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  sortOrder: number;
};

const emptyForm: PromotionForm = {
  title: "",
  description: "",
  badge: "Special offer",
  imageUrl: "",
  mobileImageUrl: "",
  ctaLabel: "Shop now",
  showOnHomepage: false,
  destinationUrl: "/deals",
  startsAt: "",
  endsAt: "",
  isActive: true,
  sortOrder: 0,
};

function dateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function promotionForm(promotion: PromotionView): PromotionForm {
  return {
    title: promotion.title,
    description: promotion.description,
    badge: promotion.badge,
    imageUrl: promotion.image_url ?? "",
    mobileImageUrl: promotion.mobile_image_url ?? "",
    ctaLabel: promotion.cta_label,
    showOnHomepage: promotion.show_on_homepage,
    destinationUrl: promotion.destination_url,
    startsAt: dateTimeInput(promotion.starts_at),
    endsAt: dateTimeInput(promotion.ends_at),
    isActive: promotion.is_active,
    sortOrder: promotion.sort_order,
  };
}

export function PromotionManager({ initialPromotions }: { initialPromotions: PromotionView[] }) {
  const [promotions, setPromotions] = useState(initialPromotions);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<"desktop" | "mobile" | null>(null);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function uploadImage(file: File | undefined, slot: "desktop" | "mobile") {
    if (!file) return;
    setUploadingSlot(slot);
    setMessage("");
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("slot", slot);
      if (editingId) body.set("campaignId", editingId);
      const response = await fetch("/api/admin/promotions/upload", { method: "POST", body });
      const result = await response.json() as { data?: { imageUrl: string }; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error ?? "Unable to upload banner image.");
      setForm((current) => ({
        ...current,
        [slot === "desktop" ? "imageUrl" : "mobileImageUrl"]: result.data!.imageUrl,
      }));
      setMessage(`${slot === "desktop" ? "Desktop" : "Mobile"} banner uploaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload banner image.");
    } finally {
      setUploadingSlot(null);
    }
  }

  async function savePromotion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/promotions", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          ...form,
          imageUrl: form.imageUrl.trim() || null,
          mobileImageUrl: form.mobileImageUrl.trim() || null,
          ctaLabel: form.ctaLabel.trim(),
          showOnHomepage: form.showOnHomepage,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        }),
      });
      const result = await response.json() as { data?: PromotionView; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error ?? "Unable to save promotion.");
      setPromotions((current) => editingId
        ? current.map((item) => item.id === result.data!.id ? result.data! : item)
        : [result.data!, ...current]);
      setMessage(editingId ? "Promotion updated." : "Promotion created.");
      resetForm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save promotion.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePromotion(id: string) {
    if (!window.confirm("Delete this promotion?")) return;
    setMessage("");
    try {
      const response = await fetch(`/api/admin/promotions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to delete promotion.");
      setPromotions((current) => current.filter((item) => item.id !== id));
      if (editingId === id) resetForm();
      setMessage("Promotion deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete promotion.");
    }
  }

  return (
    <div className="promotion-manager">
      <div className="catalog-manager-grid">
        <form className="catalog-manager-form catalog-simple-form" onSubmit={savePromotion}>
          <p className="eyebrow">Storefront deals</p>
          <h2>{editingId ? "Edit promotion" : "Create a promotion"}</h2>
          <p>Set a message, optional image, destination, and display dates for the public storefront.</p>
          {message && <div className="catalog-manager-message" role="status">{message}</div>}
          <label>Promotion title<input maxLength={120} required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label>Short description<textarea maxLength={600} rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <label>Badge<input maxLength={48} required value={form.badge} onChange={(event) => setForm({ ...form, badge: event.target.value })} /></label>
          <label>Desktop banner image<input accept="image/jpeg,image/png,image/webp" type="file" onChange={(event) => void uploadImage(event.target.files?.[0], "desktop")} /></label>
          <label>Desktop image URL<input type="url" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} /></label>
          <label>Mobile banner image (optional)<input accept="image/jpeg,image/png,image/webp" type="file" onChange={(event) => void uploadImage(event.target.files?.[0], "mobile")} /></label>
          <label>Mobile image URL<input type="url" value={form.mobileImageUrl} onChange={(event) => setForm({ ...form, mobileImageUrl: event.target.value })} /></label>
          <label>Button text<input maxLength={48} required value={form.ctaLabel} onChange={(event) => setForm({ ...form, ctaLabel: event.target.value })} /></label>
          <label>Destination URL<input required value={form.destinationUrl} onChange={(event) => setForm({ ...form, destinationUrl: event.target.value })} placeholder="/deals" /></label>
          <label>Starts at (optional)<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label>
          <label>Ends at (optional)<input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label>
          <label>Display order<input type="number" min={0} max={10000} value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} /></label>
          <label className="promotion-active-toggle"><input type="checkbox" checked={form.showOnHomepage} onChange={(event) => setForm({ ...form, showOnHomepage: event.target.checked })} /> Show as a homepage campaign banner</label>
          <label className="promotion-active-toggle"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active on the storefront</label>
          <div className="promotion-banner-preview" aria-label="Responsive banner preview">
            <div className="promotion-banner-preview-desktop">
              {form.imageUrl && <Image src={form.imageUrl} alt="" fill sizes="(max-width: 900px) 100vw, 600px" unoptimized />}
              <div><small>{form.badge || "Campaign"}</small><strong>{form.title || "Your campaign title"}</strong><span>{form.description || "Campaign description preview"}</span><b>{form.ctaLabel || "Shop now"}</b></div>
              <em>Desktop preview</em>
            </div>
            <div className="promotion-banner-preview-mobile">
              {(form.mobileImageUrl || form.imageUrl) && <Image src={form.mobileImageUrl || form.imageUrl} alt="" fill sizes="180px" unoptimized />}
              <div><small>{form.badge || "Campaign"}</small><strong>{form.title || "Campaign"}</strong><b>{form.ctaLabel || "Shop now"}</b></div>
              <em>Mobile preview</em>
            </div>
          </div>
          <div className="promotion-form-actions">
            <button className="button button-primary" type="submit" disabled={saving || uploadingSlot !== null}>{saving ? "Saving..." : uploadingSlot ? "Uploading image..." : editingId ? "Update promotion" : "Create promotion"}</button>
            {editingId && <button className="button button-secondary" type="button" onClick={resetForm}>Cancel edit</button>}
          </div>
        </form>
      </div>
      <section className="catalog-manager-list">
        <div className="section-heading"><div><p className="eyebrow">Promotion library</p><h2>Storefront promotions</h2></div><strong>{promotions.length} promotions</strong></div>
        <div className="catalog-product-list">
          {promotions.length ? promotions.map((promotion) => (
            <article className="catalog-product-row" key={promotion.id}>
              <div className="catalog-product-art">%</div>
              <div className="promotion-list-details">
                <strong>{promotion.title}</strong>
                <small>{promotion.badge} · {promotion.is_active ? "Active" : "Inactive"} · {promotion.show_on_homepage ? "Homepage banner" : "Promotion only"} · {promotion.destination_url}</small>
                <small>{promotion.starts_at ? new Date(promotion.starts_at).toLocaleString() : "No start date"} – {promotion.ends_at ? new Date(promotion.ends_at).toLocaleString() : "No end date"}</small>
              </div>
              <div className="promotion-row-actions">
                <button type="button" onClick={() => { setEditingId(promotion.id); setForm(promotionForm(promotion)); setMessage(""); }}>Edit</button>
                <button type="button" onClick={() => void deletePromotion(promotion.id)}>Delete</button>
              </div>
            </article>
          )) : <p>No promotions have been created yet.</p>}
        </div>
      </section>
    </div>
  );
}
