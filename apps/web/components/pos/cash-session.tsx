"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CircleDollarSign, Lock, PlusCircle } from "lucide-react";
import { z } from "zod";
import { summarizeCashSession, type CashSession } from "@/lib/pos/cash-session";

const cashSessionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "closed"]),
  openingFloat: z.number().finite(),
  cashSales: z.number().finite(),
  countedCash: z.number().finite().nullable(),
  expectedCash: z.number().finite(),
  notes: z.string(),
  startedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  warehouseId: z.string().uuid(),
  warehouseName: z.string()
});
const responseSchema = z.object({
  session: cashSessionSchema.nullable(),
  defaultWarehouse: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  multipleOpenSessions: z.boolean()
});

export function CashSessionPanel({ onSessionChange }: { onSessionChange: (id: string | null) => void }) {
  const [value, setValue] = useState<CashSession | null>(null);
  const [defaultWarehouse, setDefaultWarehouse] = useState<{ id: string; name: string } | null>(null);
  const [openingFloatText, setOpeningFloatText] = useState("");
  const [countedCashText, setCountedCashText] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [multipleOpenSessions, setMultipleOpenSessions] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const summary = useMemo(() => value ? summarizeCashSession(value) : null, [value]);

  const acceptResponse = useCallback((payload: unknown) => {
    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success) throw new Error("The cash session service returned an invalid response.");
    const session = parsed.data.session;
    setValue(session ? {
      ...session,
      countedCash: session.countedCash ?? null,
      startedAt: session.startedAt ?? null,
      closedAt: session.closedAt ?? null
    } : null);
    setDefaultWarehouse(parsed.data.defaultWarehouse);
    setMultipleOpenSessions(parsed.data.multipleOpenSessions);
    setCountedCashText(session?.countedCash == null
      ? ""
      : String(session.countedCash));
    setNotes(session?.notes ?? "");
    onSessionChange(session?.status === "open" && !parsed.data.multipleOpenSessions ? session.id : null);
  }, [onSessionChange]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/pos/cash-session", { cache: "no-store" });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const error = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Unable to load the cash session.";
        throw new Error(error);
      }
      acceptResponse(payload);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load the cash session.");
      onSessionChange(null);
    } finally {
      setLoading(false);
    }
  }, [acceptResponse, onSessionChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const refreshSession = () => void refresh();
    window.addEventListener("dantown-pos-cash-session-refresh", refreshSession);
    return () => window.removeEventListener("dantown-pos-cash-session-refresh", refreshSession);
  }, [refresh]);

  const submitAction = async (payload: unknown) => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/pos/cash-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const error = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : "Unable to update the cash session.";
        throw new Error(error);
      }
      acceptResponse(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update the cash session.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = () => {
    const amount = Number(openingFloatText || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      setMessage("Enter a valid opening float of zero or more.");
      return;
    }
    void submitAction({ action: "open", openingFloat: amount, notes });
  };

  const handleClose = () => {
    const amount = Number(countedCashText || 0);
    if (!value || !Number.isFinite(amount) || amount < 0 || !summary) {
      setMessage("Enter a valid counted cash amount of zero or more.");
      return;
    }
    if (!window.confirm(`Close this session with KSh ${amount.toLocaleString("en-KE")} counted cash? Expected: KSh ${summary.expected.toLocaleString("en-KE")}.`)) return;
    void submitAction({ action: "close", sessionId: value.id, countedCash: amount, notes });
  };

  return (
    <section className="pos-cash-session-panel">
      <div className="pos-session-header">
        <div>
          <p className="eyebrow">Cash control</p>
          <h3>Cash drawer</h3>
        </div>
        <span className={`pos-session-status ${value?.status ?? "closed"}`}>
          {loading ? "Loading" : multipleOpenSessions ? "Reconciliation required" : value?.status === "open" ? "Open" : value ? "Closed" : "Not opened"}
        </span>
      </div>
      {multipleOpenSessions && (
        <p className="pos-session-message warning" role="alert">
          Multiple open sessions exist for this staff account. Cash sales are blocked. Close each listed session to reconcile them before taking cash.
        </p>
      )}

      {value && summary && (
        <div className="pos-session-summary">
          <div>
            <small>Opening float</small>
            <strong>KSh {value.openingFloat.toLocaleString("en-KE")}</strong>
          </div>
          <div>
            <small>Cash sales</small>
            <strong>KSh {value.cashSales.toLocaleString("en-KE")}</strong>
          </div>
          <div>
            <small>Expected</small>
            <strong>KSh {summary.expected.toLocaleString("en-KE")}</strong>
          </div>
        </div>
      )}

      {value?.status === "open" ? (
        <div className="pos-session-controls">
          <p>Warehouse: {value.warehouseName}</p>
          <label>
            <span>Counted cash</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={countedCashText}
              onChange={(event) => setCountedCashText(event.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            <span>Notes</span>
            <input
              type="text"
              maxLength={500}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Shift notes"
            />
          </label>
          <div className="pos-session-actions">
            <button type="button" className="button button-primary" onClick={handleClose} disabled={loading || saving}>
              <Lock size={16} /> {saving ? "Closing…" : "Close session"}
            </button>
          </div>
        </div>
      ) : !loading ? (
        <div className="pos-session-controls">
          <p>{value ? `Last session closed ${value.closedAt ? new Date(value.closedAt).toLocaleString("en-KE") : ""}.` : "Open a persistent cash session before accepting cash."}</p>
          {defaultWarehouse && <p>Warehouse: {defaultWarehouse.name}</p>}
          {!defaultWarehouse && <p className="pos-session-message warning" role="alert">An active warehouse is required before a cash session can be opened.</p>}
          <label>
            <span>Opening float</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={openingFloatText}
              onChange={(event) => setOpeningFloatText(event.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            <span>Notes</span>
            <input
              type="text"
              maxLength={500}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Opening notes"
            />
          </label>
          <div className="pos-session-actions">
            <button type="button" className="button button-primary" onClick={handleOpen} disabled={saving || !defaultWarehouse}>
              <PlusCircle size={16} /> {saving ? "Opening…" : "Open cash session"}
            </button>
          </div>
        </div>
      ) : <p className="pos-session-message">Loading cash session…</p>}

      {value && summary && (
        <div className="pos-session-footer">
          <div className={`pos-session-message ${summary.isHealthy ? "good" : "warning"}`}>
            <Banknote size={16} />
            <span>{summary.message}</span>
          </div>
          {value.countedCash !== null && (
            <span className="pos-session-variance">
              <CircleDollarSign size={14} />
              Variance: KSh {summary.variance.toLocaleString("en-KE")}
            </span>
          )}
        </div>
      )}
      {message && <p className="pos-session-message warning" role="alert">{message}</p>}
      {value && <button type="button" className="button" onClick={() => void refresh()} disabled={loading || saving}>Refresh session</button>}
    </section>
  );
}
