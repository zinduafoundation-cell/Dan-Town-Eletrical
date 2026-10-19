"use client";

import { FormEvent, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { fetchWithBiometric } from "@/lib/auth/passkey-client";

export function RefundSaleButton({ orderId, orderNumber, total }: { orderId: string; orderNumber: string; total: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(String(total));
  const [cashReturned, setCashReturned] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function closeDialog() {
    setOpen(false);
    setCashReturned(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetchWithBiometric(`/api/orders/${orderId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, amount: Number(amount), cashReturned })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to process refund.");
      setOpen(false);
      setMessage("Cash refund recorded");
      setCashReturned(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to process refund.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="pos-refund-action">
    {message ? <span className="pos-refund-message" role="status">{message}</span> : <button type="button" className="pos-data-action" onClick={() => { setCashReturned(false); setOpen(true); }}><RotateCcw size={14} /> Refund</button>}
    {open && <div className="pos-refund-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
      <form className="pos-refund-dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby={`refund-title-${orderId}`}>
        <div className="pos-refund-dialog-heading"><div><p className="eyebrow">POS refund</p><h2 id={`refund-title-${orderId}`}>{orderNumber}</h2></div><button type="button" className="pos-refund-close" aria-label="Close refund dialog" onClick={closeDialog}><X size={18} /></button></div>
        <p>This workflow records cash refunds only. Return the cash to the customer before confirming; electronic refunds must be completed through the payment provider.</p>
        <label>Amount<input type="number" min="0.01" max={total} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
        <label>Reason<textarea minLength={3} maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe why this sale is being refunded" required /></label>
        <label className="pos-refund-cash-confirmation"><input type="checkbox" checked={cashReturned} onChange={(event) => setCashReturned(event.target.checked)} required /> I confirm this cash has been physically returned to the customer.</label>
        <p>Inventory is restocked only when the payment is fully refunded; partial refunds do not identify returned items.</p>
        <div className="pos-refund-dialog-actions"><button type="button" className="button button-quiet" onClick={closeDialog}>Cancel</button><button type="submit" className="button button-primary" disabled={saving || !cashReturned}>{saving ? "Recording..." : "Confirm cash returned"}</button></div>
      </form>
    </div>}
  </div>;
}