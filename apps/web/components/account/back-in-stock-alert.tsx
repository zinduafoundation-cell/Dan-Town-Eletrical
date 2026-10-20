"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function BackInStockAlert({
  productId,
  slug,
  variantId,
  variantName,
}: {
  productId: string;
  slug: string;
  variantId?: string;
  variantName?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function requestAlert() {
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/account/back-in-stock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, variantId: variantId ?? null }),
      });
      const result = await response.json();
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/products/${slug}`)}`);
        return;
      }
      if (!response.ok) throw new Error(result.error || "Unable to request a stock alert.");
      const target = variantName ? `${variantName} variant` : "product";
      setStatus(result.alreadyRequested ? "You are already subscribed to this stock alert." : `We’ll notify you when this ${target} is available.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to request a stock alert.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="back-in-stock-alert">
      <button type="button" className="button button-secondary" disabled={saving} onClick={() => void requestAlert()}>
        {saving ? "Saving alert…" : variantName ? `Notify me when ${variantName} is available` : "Notify me when available"}
      </button>
      {status ? <p role="status">{status}</p> : null}
      <small>Sign in to save this alert to your Dantown account.</small>
      <Link href="/account/settings">Manage stock alert preferences</Link>
    </div>
  );
}
