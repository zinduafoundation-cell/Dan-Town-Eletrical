import { requireAuthorizedPermission } from "../../../lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { PortalShell } from "../../portal-shell";
import { AutomationStatusPanel } from "@/components/admin/automation-status-panel";

export const dynamic = "force-dynamic";

async function getAutomationOverview() {
  try {
    const supabase = createSupabaseServiceClient();
    const { data: jobs } = await supabase
      ?.from("automation_jobs")
      ?.select("id, workflow_name, status, source, payload, created_at")
      ?.order("id", { ascending: false })
      ?.limit(5);

    return jobs ?? [];
  } catch (error) {
    console.error("Failed to load automation overview data:", error);
    return [];
  }
}

export default async function AutomationPage() {
  const context = await requireAuthorizedPermission("automation.read");
  const jobs = await getAutomationOverview();

  const countBySource = {
    whatsapp: jobs.filter((job) => {
      const payload = typeof job.payload === "object" && job.payload ? (job.payload as Record<string, unknown>) : {};
      const channel = typeof payload.channel === "string" ? payload.channel : "";
      return job.source.toUpperCase().includes("WHATSAPP") || channel.toLowerCase().includes("whatsapp");
    }).length,
    email: jobs.filter((job) => {
      const payload = typeof job.payload === "object" && job.payload ? (job.payload as Record<string, unknown>) : {};
      const template = typeof payload.emailTemplate === "string" ? payload.emailTemplate : "";
      return job.source.toUpperCase().includes("EMAIL") || template.length > 0;
    }).length,
    crm: jobs.filter((job) => {
      const payload = typeof job.payload === "object" && job.payload ? (job.payload as Record<string, unknown>) : {};
      const customerName = typeof payload.customerName === "string" ? payload.customerName : "";
      return job.source.toUpperCase().includes("CRM") || customerName.length > 0;
    }).length,
    ai: jobs.filter((job) => {
      const payload = typeof job.payload === "object" && job.payload ? (job.payload as Record<string, unknown>) : {};
      const query = typeof payload.userQuery === "string" ? payload.userQuery : "";
      return job.source.toUpperCase().includes("AI") || query.length > 0;
    }).length,
  };

  const describeJob = (job: { workflow_name: string; source: string; payload: unknown }) => {
    const payload = typeof job.payload === "object" && job.payload ? (job.payload as Record<string, unknown>) : {};
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
    const query = typeof payload.userQuery === "string" ? payload.userQuery.trim() : "";
    const customerName = typeof payload.customerName === "string" ? payload.customerName.trim() : "";
    const summary = typeof payload.summary === "string" ? payload.summary.trim() : "";

    if (message) return message;
    if (subject) return subject;
    if (query) return query;
    if (customerName) return customerName;
    if (summary) return summary;

    return `${job.workflow_name} · ${job.source}`;
  };

  return (
    <PortalShell
      title="Automation, under control."
      description="Review supplier ingestion, product intelligence, customer communications and AI workflows without giving orchestration ownership of the data."
      roles={context.roles}
      permissions={context.permissions}
      links={[
        { label: "Automation overview", href: "/admin/automation" },
        { label: "Review inbox", href: "/admin/automation/inbox" },
        { label: "Pricing", href: "/admin/automation/pricing", permission: "pricing.read" },
        { label: "Errors", href: "/admin/automation/errors" },
        { label: "History", href: "/admin/automation/history" },
      ]}
    >
      <AutomationStatusPanel jobs={jobs} n8nConfigured={Boolean(process.env.N8N_WEBHOOK_SECRET)} />

      <div className="portal-grid">
        <article className="portal-card">
          <small>Source of truth</small>
          <strong>Supabase</strong>
        </article>
        <article className="portal-card">
          <small>Orchestration</small>
          <strong>n8n</strong>
        </article>
        <article className="portal-card">
          <small>AI role</small>
          <strong>Recommend only</strong>
        </article>
      </div>

      <div className="portal-grid" style={{ marginTop: "1.5rem" }}>
        <article className="portal-card">
          <small>WhatsApp</small>
          <strong>{countBySource.whatsapp}</strong>
        </article>
        <article className="portal-card">
          <small>Email</small>
          <strong>{countBySource.email}</strong>
        </article>
        <article className="portal-card">
          <small>CRM</small>
          <strong>{countBySource.crm}</strong>
        </article>
        <article className="portal-card">
          <small>AI assistant</small>
          <strong>{countBySource.ai}</strong>
        </article>
      </div>

      <div className="portal-grid" style={{ marginTop: "1.5rem" }}>
        <article className="portal-card" style={{ gridColumn: "1 / -1" }}>
          <small>Recent workflow activity</small>
          <strong>{jobs.length ? `${jobs.length} jobs tracked` : "No jobs found"}</strong>

          {jobs.length ? (
            <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
              {jobs.map((job) => (
                <div key={job.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                    <span>{job.workflow_name}</span>
                    <span style={{ textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.08em" }}>
                      {job.status}
                    </span>
                  </div>
                  <small style={{ display: "block", marginTop: "0.25rem" }}>
                    {job.source} · {describeJob(job)}
                  </small>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      </div>
    </PortalShell>
  );
}