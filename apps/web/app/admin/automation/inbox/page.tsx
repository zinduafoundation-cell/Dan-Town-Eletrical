import { requireAuthorizedPermission } from "../../../../lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { PortalShell } from "../../../portal-shell";
import { ImportCentre } from "@/components/admin/import-centre";

export const dynamic = "force-dynamic";

async function getInboxItems() {
  try {
    const supabase = createSupabaseServiceClient();

    const [
      { data: matches, error: matchesError },
      { data: productJobs, error: jobsError },
      { data: catalogueJobs, error: catalogueJobsError },
      { data: departments, error: departmentsError },
      { data: categories, error: categoriesError },
      { data: brands, error: brandsError },
    ] = await Promise.all([
      supabase
        ?.from("product_matches")
        ?.select("id, product_id, source_name, normalized_name, match_status, confidence, supplier_sku")
        ?.order("id", { ascending: false })
        ?.limit(8),
      supabase
        ?.from("automation_jobs")
        ?.select("id, source, status, payload, created_at")
        ?.eq("workflow_name", "PRODUCT_INGESTION")
        ?.neq("source", "CENTRE_CATALOGUE_CSV")
        ?.in("status", ["RECEIVED", "REQUIRES_REVIEW"])
        ?.order("created_at", { ascending: false })
        ?.limit(8),
      supabase
        .from("automation_jobs")
        .select("id,status,source_reference,created_at")
        .eq("workflow_name", "PRODUCT_INGESTION")
        .eq("source", "CENTRE_CATALOGUE_CSV")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("departments").select("id,name").eq("is_active", true).order("sort_order"),
      supabase.from("categories").select("id,name,department_id,parent_id").eq("is_active", true).order("sort_order"),
      supabase.from("brands").select("id,name").eq("is_active", true).order("name"),
    ]);
    const queryError = matchesError ?? jobsError ?? catalogueJobsError ?? departmentsError ?? categoriesError ?? brandsError;
    if (queryError) throw queryError;

    const productIds = [...new Set((matches ?? []).map((match) => match.product_id).filter((productId): productId is string => Boolean(productId)))];
    const { data: products, error: productsError } = productIds.length
      ? await supabase.from("products").select("id,name,sku,retail_price,cost_price").in("id", productIds)
      : { data: [] };
    if (productsError) throw productsError;

    const productMap = new Map((products ?? []).map((product) => [product.id, product]));

    return {
      matches: (matches ?? []).map((match) => ({
        ...match,
        existingProduct: match.product_id ? productMap.get(match.product_id) ?? null : null,
      })),
      productJobs: productJobs ?? [],
      catalogueJobs: catalogueJobs ?? [],
      departments: departments ?? [],
      categories: categories ?? [],
      brands: brands ?? [],
      loadError: null,
    };
  } catch (error) {
    console.error("Failed to load automation inbox:", error);
    return {
      matches: [],
      productJobs: [],
      catalogueJobs: [],
      departments: [],
      categories: [],
      brands: [],
      loadError: "Inbox data could not be loaded. Check server logs or try again.",
    };
  }
}

export default async function AutomationInboxPage() {
  const context = await requireAuthorizedPermission("automation.read");
  const { matches, productJobs, catalogueJobs, departments, categories, brands, loadError } = await getInboxItems();
  const canApproveProducts = context.permissions.includes("automation.manage") && context.permissions.includes("products.update");

  return (
    <PortalShell
      title="Review inbox."
      description="Possible matches, new products and failed documents await a decision."
      roles={context.roles}
      permissions={context.permissions}
      links={[
        { label: "Overview", href: "/admin/automation" },
        { label: "Inbox", href: "/admin/automation/inbox" },
        { label: "Pricing", href: "/admin/automation/pricing", permission: "pricing.read" },
      ]}
    >
      {canApproveProducts
        ? <ImportCentre departments={departments} categories={categories} brands={brands} />
        : <div className="portal-card import-centre-permission">Import and review permission is required to submit supplier files.</div>}

      {loadError && <p className="catalogue-import-load-error" role="alert">{loadError}</p>}

      {catalogueJobs.length > 0 && (
        <section className="portal-card catalogue-import-jobs" aria-labelledby="catalogue-import-jobs-heading">
          <p className="eyebrow">Catalogue staging history</p>
          <h2 id="catalogue-import-jobs-heading">Recent full-catalogue imports</h2>
          <p>These jobs stage product candidates for review only. To resume an interrupted upload, select the same CSV again above.</p>
          <ul>{catalogueJobs.map((job) => (
            <li key={job.id}>
              <span><strong>{job.source_reference || "Catalogue CSV"}</strong><small>{new Date(job.created_at).toLocaleString()}</small></span>
              <span className={`catalogue-import-job-status is-${job.status.toLowerCase()}`}>{job.status.replaceAll("_", " ")}</span>
            </li>
          ))}</ul>
        </section>
      )}

      <div className="portal-grid">
        <article className="portal-card">
          <small>Possible matches</small>
          <strong>{matches.length ? `${matches.length} awaiting review` : "Awaiting review"}</strong>
        </article>
        <article className="portal-card">
          <small>New products</small>
          <strong>{productJobs.length ? `${productJobs.length} awaiting review` : "No pending imports"}</strong>
        </article>
        <article className="portal-card">
          <small>Failed documents</small>
          <strong>Retryable</strong>
        </article>
      </div>

      {productJobs.length > 0 ? (
        <div className="portal-grid" style={{ marginTop: "1.5rem" }}>
          <article className="portal-card" style={{ gridColumn: "1 / -1" }}>
            <small>Product ingestion queue</small>
            <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
              {productJobs.map((job) => {
                const payload = job.payload as {
                  product?: { name?: string; sku?: string | null; sellingPrice?: number | null };
                  action?: string;
                };
                const product = payload.product ?? {};

                return (
                  <div key={job.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                      <strong>{product.name || "Unnamed product"}</strong>
                      <span style={{ textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.08em" }}>
                        {payload.action || "REVIEW_REQUIRED"}
                      </span>
                    </div>
                    <small style={{ display: "block", marginTop: "0.25rem" }}>
                      SKU: {product.sku || "Pending"} · Source: {job.source} · {new Date(job.created_at).toLocaleString()}
                    </small>

                    {canApproveProducts ? (
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                        <form action="/api/admin/automation/product-approve" method="post">
                          <input type="hidden" name="jobId" value={job.id} />
                          <input type="hidden" name="decision" value="approve" />
                          <button className="button button-primary" type="submit">Approve draft</button>
                        </form>
                        <form action="/api/admin/automation/product-approve" method="post">
                          <input type="hidden" name="jobId" value={job.id} />
                          <input type="hidden" name="decision" value="reject" />
                          <button className="button button-quiet" type="submit">Reject</button>
                        </form>
                      </div>
                    ) : (
                      <small style={{ display: "block", marginTop: "0.75rem" }}>Approval permission required.</small>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      ) : null}

      {matches.length > 0 ? (
        <div className="portal-grid" style={{ marginTop: "1.5rem" }}>
          <article className="portal-card" style={{ gridColumn: "1 / -1" }}>
            <small>Latest product matches</small>
            <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
              {matches.map((match) => (
                <div key={match.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                    <strong>
                      {match.normalized_name} vs {match.existingProduct?.name || "New product"}
                    </strong>
                    <span style={{ textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.08em" }}>
                      {match.match_status}
                    </span>
                  </div>
                  <small style={{ display: "block", marginTop: "0.25rem" }}>
                    Incoming SKU: {match.supplier_sku ?? "Pending"} · Existing SKU: {match.existingProduct?.sku || "None"} · Confidence: {match.confidence}
                  </small>
                  <small style={{ display: "block", marginTop: "0.25rem" }}>
                    Incoming source: {match.source_name} · Existing retail: {match.existingProduct ? `KSh ${Number(match.existingProduct.retail_price ?? 0).toLocaleString()}` : "Not available"}
                  </small>
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}
    </PortalShell>
  );
}