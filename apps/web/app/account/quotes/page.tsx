import { requireAuthenticated } from "../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { PortalShell } from "../../portal-shell";

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
    : { data: [] }; const quotes = quotesData ?? [];

  return (
    <PortalShell
      title="Your quotes."
      description="Review project pricing and quotation status."
      roles={context.roles}
      permissions={context.permissions}
      links={[
        { label: "Overview", href: "/account" },
        { label: "Orders", href: "/account/orders" },
        { label: "Quotes", href: "/account/quotes" },
        { label: "Wishlist", href: "/account/wishlist" },
      ]}
    >
      <div className="content-panel">
        {quotes.length ? (
          quotes.map((quote) => (
            <article className="portal-list-row" key={quote.id}>
              <div>
                <strong>{quote.quote_number}</strong>
                <small>{new Date(quote.created_at).toLocaleDateString()}</small>
              </div>
              <div>
                <strong>KSh {Number(quote.total).toLocaleString()}</strong>
                <small>
                  {quote.status}
                  {quote.valid_until ? ` · valid until ${quote.valid_until}` : ""}
                </small>
              </div>
            </article>
          ))
        ) : (
          <p>No quotes yet.</p>
        )}
      </div>
    </PortalShell>
  );
}
