"use client";

import { useMemo, useState } from "react";
import { Banknote, CircleDollarSign, Lock, PlusCircle } from "lucide-react";
import {
  closeCashSession,
  createCashSession,
  saveCashSession,
  summarizeCashSession,
  type CashSession
} from "@/lib/pos/cash-session";

export function CashSessionPanel({
  value,
  onChange
}: {
  value: CashSession;
  onChange: (next: CashSession) => void;
}) {
  const [openingFloatText, setOpeningFloatText] = useState(String(value.openingFloat || ""));
  const [countedCashText, setCountedCashText] = useState(value.countedCash !== null ? String(value.countedCash) : "");
  const [notes, setNotes] = useState(value.notes);

  const summary = useMemo(() => summarizeCashSession(value), [value]);

  const handleOpen = () => {
    const amount = Number(openingFloatText || 0);
    const next = saveCashSession(createCashSession(amount, notes));
    onChange(next);
    setCountedCashText("");
  };

  const handleClose = () => {
    const amount = Number(countedCashText || 0);
    const next = saveCashSession(closeCashSession(value, amount, notes));
    onChange(next);
  };

  const openLabel = value.status === "open" ? "Restart session" : "Open cash session";

  return (
    <section className="pos-cash-session-panel">
      <div className="pos-session-header">
        <div>
          <p className="eyebrow">Cash control</p>
          <h3>Cash drawer</h3>
        </div>
        <span className={`pos-session-status ${value.status}`}>{value.status === "open" ? "Open" : "Closed"}</span>
      </div>

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

      {value.status === "open" ? (
        <div className="pos-session-controls">
          <label>
            <span>Counted cash</span>
            <input
              type="number"
              min="0"
              value={countedCashText}
              onChange={(event) => setCountedCashText(event.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            <span>Notes</span>
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Shift notes"
            />
          </label>
          <div className="pos-session-actions">
            <button type="button" className="button button-primary" onClick={handleClose}>
              <Lock size={16} /> Close session
            </button>
          </div>
        </div>
      ) : (
        <div className="pos-session-controls">
          <label>
            <span>Opening float</span>
            <input
              type="number"
              min="0"
              value={openingFloatText}
              onChange={(event) => setOpeningFloatText(event.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            <span>Notes</span>
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Opening notes"
            />
          </label>
          <div className="pos-session-actions">
            <button type="button" className="button button-primary" onClick={handleOpen}>
              <PlusCircle size={16} /> {openLabel}
            </button>
          </div>
        </div>
      )}

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
    </section>
  );
}
