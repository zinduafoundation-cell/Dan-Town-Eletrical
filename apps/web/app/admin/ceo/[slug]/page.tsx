import { requireAuthorizedRole } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { PortalShell } from "../../../portal-shell";

export const dynamic = "force-dynamic";

const labelMap: Record<string, string> = {
  sales: "Sales",
  profit: "Profit",
  inventory: "Inventory",
  customers: "Customers",
  forecast: "Forecast",
  insights: "Insights"
};

async function getSectionSummary(slug: string) {
  const supabase = createSupabaseServiceClient();

  switch (slug) {
    case "sales": {
      const { data, error } = await supabase.from("orders").select("total");
      const total = (data ?? []).reduce((sum, row) => sum + Number(row.total ?? 0), 0);
      return { title: labelMap[slug], count: error ? 0 : total, detail: "Gross sales value" };
    }
    case "profit": {
      const { data, error } = await supabase.from("orders").select("total");
      const total = (data ?? []).reduce((sum, row) => sum + Number(row.total ?? 0), 0);
      return { title: labelMap[slug], count: error ? 0 : total * 0.22, detail: "Projected net value" };
    }
    case "inventory": {
      const { data, error } = await supabase.from("inventory").select("quantity");
      const total = (data ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
      return { title: labelMap[slug], count: error ? 0 : total, detail: "Available units" };
    }
    case "customers": {
      const { count, error } = await supabase.from("customers").select("id", { count: "exact", head: true });
      return { title: labelMap[slug], count: error ? 0 : count ?? 0, detail: "Active customer base" };
    }
    case "forecast": {
      return { title: labelMap[slug], count: 0, detail: "Forecasting model ready" };
    }
    case "insights": {
      return { title: labelMap[slug], count: 0, detail: "AI summary available" };
    }
    default:
      return { title: labelMap[slug] ?? slug.replace(/-/g, " "), count: 0, detail: "Executive overview" };
  }
}

export default async function CeoSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await requireAuthorizedRole("CEO");
  const route = slug ?? "sales";
  const summary = await getSectionSummary(route);
  const title = labelMap[route] ?? route.replace(/-/g, " ");

  return (
    <PortalShell
      title={`${title} overview`}
      description={`Executive metric view for ${title.toLowerCase()} in the Dantown operating model.`}
      roles={context.roles}
      permissions={context.permissions}
      links={[
        { label: "Overview", href: "/admin/ceo" },
        { label: "Sales", href: "/admin/ceo/sales" },
        { label: "Profit", href: "/admin/ceo/profit" },
        { label: "Inventory", href: "/admin/ceo/inventory" },
        { label: "Customers", href: "/admin/ceo/customers" },
        { label: "Forecast", href: "/admin/ceo/forecast" },
        { label: "Insights", href: "/admin/ceo/insights" }
      ]}
    >
      <div className="portal-grid">
        <article className="portal-card">
          <small>Signal</small>
          <strong>{summary.title}</strong>
        </article>
        <article className="portal-card">
          <small>Value</small>
          <strong>{summary.count.toLocaleString()}</strong>
        </article>
        <article className="portal-card">
          <small>Context</small>
          <strong>{summary.detail}</strong>
        </article>
      </div>
    </PortalShell>
  );
}
