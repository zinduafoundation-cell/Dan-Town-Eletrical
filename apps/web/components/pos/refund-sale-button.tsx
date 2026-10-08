"use client";

import { FormEvent, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { fetchWithBiometric } from "@/lib/auth/passkey-client";

export function RefundSaleButton({ orderId, orderNumber, total }: { orderId: string; orderNumber: string; total: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(String(total));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetchWithBiometric(`/api/orders/${orderId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, amount: Number(amount) })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to process refund.");
      setOpen(false);
      setMessage("Refund recorded");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to process refund.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="pos-refund-action">
    {message ? <span className="pos-refund-message" role="status">{message}</span> : <button type="button" className="pos-data-action" onClick={() => setOpen(true)}><RotateCcw size={14} /> Refund</button>}
    {open && <div className="pos-refund-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <form className="pos-refund-dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby={`refund-title-${orderId}`}>
        <div className="pos-refund-dialog-heading"><div><p className="eyebrow">POS refund</p><h2 id={`refund-title-${orderId}`}>{orderNumber}</h2></div><button type="button" className="pos-refund-close" aria-label="Close refund dialog" onClick={() => setOpen(false)}><X size={18} /></button></div>
        <p>Refunds reverse the sale through the existing inventory and audit workflow.</p>
        <label>Amount<input type="number" min="0.01" max={total} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
        <label>Reason<textarea minLength={3} maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe why this sale is being refunded" required /></label>
        <div className="pos-refund-dialog-actions"><button type="button" className="button button-quiet" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Processing..." : "Confirm refund"}</button></div>
      </form>
    </div>}
  </div>;
}