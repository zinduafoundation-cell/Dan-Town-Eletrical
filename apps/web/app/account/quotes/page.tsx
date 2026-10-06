import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requireAuthenticated } from "../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { StorefrontShell } from "@/components/storefront";
import { buildQuoteStatusSummary } from "@/lib/quote-status";

export const dynamic = "force-dynamic";

export default async function AccountQuotesPage() {
  const context = await requireAuthenticated();
  const supabase = await createSupabaseServerClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", context.userId)
    .maybeSingle();

  const { data: quotesData } = customer
    ? await supabase
        .from("quotations")
        .select("id, quote_number, total, status, valid_until, created_at")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
    : { data: [] };
  const quotes = quotesData ?? [];

  return (
    <StorefrontShell>
      <main className="page-shell account-subpage">
        <Link className="back-link" href="/account"><ArrowLeft size={17} /> Back to My Dantown Hub</Link>
        <section className="account-subpage-card account-data-card">
          <p className="eyebrow">My Dantown Hub</p>
          <h1>Electrical quotations</h1>
          <p>Track your project quotations, approvals, and validity windows.</p>
          {quotes.length ? (
            <div className="account-detail-grid" style={{ marginTop: 20 }}>
              {quotes.map((quote) => {
                const summary = buildQuoteStatusSummary({
                  status: quote.status,
                  total: quote.total,
                  valid_until: quote.valid_until
                });

                return (
                  <div className="account-address-card" key={quote.id}>
                    <strong>{quote.quote_number || "Quote request"}</strong>
                    <span>{summary.label}</span>
                    <span>{summary.validity}</span>
                    <span>{summary.amount}</span>
                    <Link className="text-link" href="/request-quote">Request a new quote <ArrowRight size={15} /></Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state"><h3>No quotes yet.</h3><p>Request a new quote for a project, installation, or bulk order.</p><Link className="button button-primary" href="/request-quote">Request a quotation <ArrowRight size={16} /></Link></div>
          )}
        </section>
      </main>
    </StorefrontShell>
  );
}
