import { requireAuthorizedPermission } from "../../../../lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { PortalShell } from "../../../portal-shell";

export const dynamic = "force-dynamic";

export default async function AutomationHistoryPage() {
  const context = await requireAuthorizedPermission("orders.read");
  const supabase = createSupabaseServiceClient();

  const { data: records } = await supabase
    .from("pos_sync_records")
    .select("transaction_id,device_id,status,retry_count,error_message,created_at,synced_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = records ?? [];
  const pending = rows.filter((row) => ["PENDING", "SYNCING"].includes(row.status)).length;
  const failed = rows.filter((row) => ["FAILED", "CONFLICT"].includes(row.status)).length;

  return (
    <PortalShell
      title="Sync monitor."
      description="Offline POS transactions, retries, conflicts, and successful synchronization from the shared sync ledger."
      roles={context.roles}
      permissions={context.permissions}
      links={[
        { label: "Automation", href: "/admin/automation" },
        { label: "Sync monitor", href: "/admin/automation/history" },
        { label: "Review inbox", href: "/admin/automation/inbox", permission: "automation.read" },
      ]}
    >
      <div className="portal-grid">
        <article className="portal-card">
          <small>Pending</small>
          <strong>{pending}</strong>
        </article>
        <article className="portal-card">
          <small>Failed / conflicts</small>
          <strong>{failed}</strong>
        </article>
        <article className="portal-card">
          <small>Records shown</small>
          <strong>{rows.length}</strong>
        </article>
      </div>

      <section className="portal-card sync-monitor-table">
        <h2>Recent offline transactions</h2>
        {rows.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Device</th>
                <th>Status</th>
                <th>Retries</th>
                <th>Error</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.transaction_id}>
                  <td>{row.transaction_id.slice(0, 8)}...</td>
                  <td>{row.device_id.slice(0, 8)}...</td>
                  <td>
                    <span className={`sync-status sync-status-${row.status.toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{row.retry_count}</td>
                  <td>{row.error_message || "-"}</td>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No offline sync records are available yet.</p>
        )}
      </section>
    </PortalShell>
  );
}