import { AlertTriangle, Fingerprint, PackagePlus } from "lucide-react";
import type { ReorderLine, StaffActivityRow } from "@/lib/centre/insights";
import { ReorderCopyButton } from "@/components/centre/reorder-copy-button";

export function StaffActivityPanel({ rows }: { rows: StaffActivityRow[] }) {
  return (
    <section className="portal-card centre-panel">
      <div className="centre-panel-heading"><div><p className="eyebrow">Accountability</p><h2>Staff activity today</h2></div></div>
      {rows.length ? (
        <div className="centre-order-list">
          {rows.map((row) => (
            <div className="centre-order-row" key={row.userId}>
              <div>
                <strong>{row.name}</strong>
                <small><Fingerprint size={12} /> {row.biometricSignIns} biometric check{row.biometricSignIns === 1 ? "" : "s"}{row.failedChecks ? ` · ${row.failedChecks} failed` : ""}</small>
              </div>
              <div>
                <strong>KSh {Math.round(row.posRevenue).toLocaleString()}</strong>
                <small>{row.posSales} sale{row.posSales === 1 ? "" : "s"} · {row.refunds} refund{row.refunds === 1 ? "" : "s"}</small>
              </div>
            </div>
          ))}
        </div>
      ) : <p>No staff activity has been recorded yet today.</p>}
      <p className="centre-note">Everyone shares one role, so this shows who actually made each sale and approval.</p>
    </section>
  );
}

export function ReorderPanel({ lines }: { lines: ReorderLine[] }) {
  return (
    <section className="portal-card centre-panel">
      <div className="centre-panel-heading"><div><p className="eyebrow">Stock</p><h2><PackagePlus size={18} /> Reorder list</h2></div></div>
      {lines.length ? (
        <>
          <div className="centre-order-list">
            {lines.map((line) => (
              <div className="centre-order-row" key={line.productId}>
                <div><strong>{line.name}</strong><small>{line.sku}</small></div>
                <div><strong>Order {line.suggested}</strong><small>{line.available === 0 ? <><AlertTriangle size={12} /> out of stock</> : `${line.available} left (min ${line.reorderLevel})`}</small></div>
              </div>
            ))}
          </div>
          <ReorderCopyButton lines={lines} />
        </>
      ) : <p>Nothing needs reordering right now. Set reorder levels in Inventory to enable suggestions.</p>}
    </section>
  );
}
