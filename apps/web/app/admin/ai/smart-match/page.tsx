import { requireAuthorizedPermission } from "../../../../lib/auth/server";
import { createSupabaseServiceClient } from "../../../../lib/supabase/server";
import { PortalShell } from "../../../portal-shell";

export const dynamic = "force-dynamic";

export default async function SmartMatchAdminPage() {
  const context = await requireAuthorizedPermission("orders.read");
  const supabase = createSupabaseServiceClient();
  const [{ data: events, error: eventsError }, { data: requests, error: requestsError }] = await Promise.all([
    supabase.from("audit_logs").select("id, action, new_data, created_at").eq("resource_type", "smart_match").order("created_at", { ascending: false }).limit(50),
    supabase.from("ai_support_escalations").select("id, summary, status, created_at").eq("category", "SMART_MATCH_QUOTE").order("created_at", { ascending: false }).limit(50),
  ]);
  if (eventsError) console.error("Unable to load Smart Match activity:", eventsError.message);
  if (requestsError) console.error("Unable to load Smart Match quote requests:", requestsError.message);
  const links = [
    { label: "Overview", href: "/admin" },
    { label: "Smart Match activity", href: "/admin/ai/smart-match", permission: "orders.read" as const },
  ];

  return <PortalShell title="Dantown AI Smart Match" description="Recent customer scans and quote requests. Uploads are not stored; activity records contain event types and aggregate counts only." roles={context.roles} permissions={context.permissions} links={links}>
    <div className="smart-match-admin-grid">
      <section className="portal-card">
        <p className="eyebrow">Scan activity</p>
        <h2>Recent Smart Match events</h2>
        {eventsError && <p role="alert">Scan activity could not be loaded. Please try again later.</p>}
        {!eventsError && !events?.length ? <p>No Smart Match events have been recorded yet.</p> : events && <div className="smart-match-admin-list">{events.map((event) => <article key={event.id}>
          <strong>{event.action.replaceAll("_", " ").replace("SMART MATCH ", "")}</strong>
          <p>{Object.entries((event.new_data && typeof event.new_data === "object" ? event.new_data : {}) as Record<string, unknown>).map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`).join(" · ")}</p>
          <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</time>
        </article>)}</div>}
      </section>
      <section className="portal-card">
        <p className="eyebrow">Customer follow-up</p>
        <h2>Quotation requests</h2>
        {requestsError && <p role="alert">Quotation requests could not be loaded. Please try again later.</p>}
        {!requestsError && !requests?.length ? <p>No quotation requests have been received yet.</p> : requests && <div className="smart-match-admin-list">{requests.map((request) => <article key={request.id}>
          <div className="smart-match-admin-request-head"><strong>{request.status}</strong><time dateTime={request.created_at}>{new Date(request.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</time></div>
          <p>{request.summary}</p>
          <small>Request ID: {request.id}</small>
        </article>)}</div>}
      </section>
    </div>
  </PortalShell>;
}
