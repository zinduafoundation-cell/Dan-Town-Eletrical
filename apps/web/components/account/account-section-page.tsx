import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, CircleHelp, FileText, MapPin, Settings, ShieldCheck, Wrench } from "lucide-react";
import { StorefrontShell } from "@/components/storefront";
import { requireAuthenticated } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildCustomerProfileSummary } from "@/lib/customer-profile";
import { buildOrderDocumentSummary } from "@/lib/order-documents";
import { buildQuoteStatusSummary } from "@/lib/quote-status";

const sectionContent: Record<string, { title: string; description: string; icon: typeof Settings; status?: string; action?: { href: string; label: string } }> = {
  profile: { title: "My profile", description: "Keep your customer details up to date for orders, quotations, and delivery.", icon: Settings, action: { href: "#profile-details", label: "Profile details" } },
  quotations: { title: "Electrical quotations", description: "Request and review pricing for electrical materials, installations, and projects.", icon: FileText, action: { href: "/request-quote", label: "Request a quotation" } },
  projects: { title: "My electrical projects", description: "Project tracking is being prepared. Contact Dantown to discuss a current project or request help with your next one.", icon: Wrench, status: "Coming soon", action: { href: "/contact", label: "Contact Dantown" } },
  installations: { title: "Installation tracking", description: "Online visit and installation tracking is coming soon. Contact Dantown for updates on a scheduled installation.", icon: Wrench, status: "Coming soon", action: { href: "/contact", label: "Ask about an installation" } },
  "saved-products": { title: "Saved products", description: "Products you save while shopping will be ready here for your next project.", icon: ShieldCheck, action: { href: "/shop", label: "Explore electrical products" } },
  addresses: { title: "Delivery addresses", description: "Manage the addresses used for your Dantown deliveries and project visits.", icon: MapPin, action: { href: "#new-address", label: "Add an address" } },
  payments: { title: "Payment methods", description: "Payment options are confirmed securely during checkout.", icon: ShieldCheck, action: { href: "/shop", label: "Continue shopping" } },
  warranty: { title: "Receipts & documents", description: "View your recent order receipts, invoice references, and payment summaries in one place.", icon: FileText, action: { href: "/account/orders", label: "View purchases" } },
  support: { title: "Help centre", description: "Get help with orders, delivery, products, installation, warranty, or quotations.", icon: CircleHelp, action: { href: "/contact", label: "Contact Dantown support" } },
  settings: { title: "Account preferences", description: "Manage notifications and account preferences securely.", icon: Settings, action: { href: "/account", label: "Back to My Dantown Hub" } }
};

export async function AccountSectionPage({ section }: { section: string }) {
  const context = await requireAuthenticated();
  const supabase = await createSupabaseServerClient();
  const content = sectionContent[section] ?? sectionContent.settings;
  const Icon = content.icon;
  if (section === "quotations") {
    const { data: customer } = await supabase.from("customers").select("id").eq("user_id", context.userId).maybeSingle();
    const { data: quotes } = customer ? await supabase.from("quotations").select("id, quote_number, total, status, valid_until").eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(3) : { data: [] };
    const latestQuote = (quotes ?? [])[0];
    const summary = latestQuote ? buildQuoteStatusSummary({
      status: latestQuote.status,
      total: latestQuote.total,
      valid_until: latestQuote.valid_until
    }) : { label: "No quote yet", amount: "KSh 0", validity: "No validity date yet", summary: "No quote yet" };

    return <AccountDataShell title="Electrical quotations" description="Your recent quotation activity and current pricing status." icon={Icon}><div className="account-detail-grid"><Detail label="Latest quote" value={latestQuote?.quote_number || "No quote yet"} /><Detail label="Status" value={summary.label} /><Detail label="Total" value={summary.amount} /><Detail label="Valid until" value={summary.validity} /></div></AccountDataShell>;
  }

  if (section === "profile") {
    const [{ data: profile }, { data: customer }, { count: orderCount }, { count: quoteCount }, { count: addressCount }] = await Promise.all([
      supabase.from("profiles").select("full_name, phone, status").eq("id", context.userId).maybeSingle(),
      supabase.from("customers").select("id, name, email, phone, customer_type, tax_number, notes, status").eq("user_id", context.userId).maybeSingle(),
      customerIdQuery(supabase, context.userId, "orders"),
      customerIdQuery(supabase, context.userId, "quotations"),
      customerAddressCountQuery(supabase, context.userId)
    ]);

    const customerRecord = customer ?? {
      id: null,
      name: null,
      email: null,
      phone: null,
      customer_type: null,
      tax_number: null,
      notes: null,
      status: null
    };

    const summary = buildCustomerProfileSummary(customerRecord, {
      addressCount: addressCount ?? 0,
      orderCount: orderCount ?? 0,
      quoteCount: quoteCount ?? 0
    });

    return <AccountDataShell title="My profile" description="Your verified Dantown customer information." icon={Icon}><div className="account-detail-grid"><Detail label="Full name" value={profile?.full_name || customerRecord.name || "Not added"} /><Detail label="Email" value={customerRecord.email || "Not added"} /><Detail label="Phone" value={profile?.phone || customerRecord.phone || "Not added"} /><Detail label="Customer type" value={customerRecord.customer_type ? customerRecord.customer_type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Retail"} /><Detail label="Tax registration" value={summary.taxLabel} /><Detail label="Account status" value={profile?.status || customerRecord.status || "Active"} /></div><div className="account-detail-grid" style={{ marginTop: 12 }}><div className="account-detail"><small>Customer 360</small><strong>{summary.overview}</strong></div>{customerRecord.notes ? <div className="account-detail"><small>Notes</small><strong>{customerRecord.notes}</strong></div> : <div className="account-detail"><small>Notes</small><strong>No account notes yet</strong></div>}</div></AccountDataShell>;
  }
  if (section === "addresses") {
    const { data: customer } = await supabase.from("customers").select("id").eq("user_id", context.userId).maybeSingle();
    const { data: addresses } = customer ? await supabase.from("customer_addresses").select("id, label, recipient_name, phone, address_line_1, address_line_2, city, county, postal_code, is_default").eq("customer_id", customer.id).order("is_default", { ascending: false }) : { data: [] };
    return <AccountDataShell title="Delivery addresses" description="Saved delivery details for your Dantown orders." icon={Icon}>{addresses?.length ? <div className="account-detail-grid">{addresses.map((address) => <div className="account-address-card" key={address.id}><strong>{address.label}{address.is_default ? " · Default" : ""}</strong><span>{address.recipient_name} · {address.phone || "No phone"}</span><span>{address.address_line_1}{address.address_line_2 ? `, ${address.address_line_2}` : ""}</span><span>{[address.city, address.county, address.postal_code].filter(Boolean).join(", ")}</span></div>)}</div> : <EmptyData text="No delivery addresses saved yet." />}</AccountDataShell>;
  }
  if (section === "warranty") {
    const { data: customer } = await supabase.from("customers").select("id").eq("user_id", context.userId).maybeSingle();
    const { data: orders } = customer ? await supabase.from("orders").select("id, order_number, total, order_status, payment_status, created_at").eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(5) : { data: [] };

    const documents = (orders ?? []).map((order) => ({
      ...buildOrderDocumentSummary({
        order_number: order.order_number,
        total: order.total,
        payment_status: order.payment_status,
        order_status: order.order_status,
        created_at: order.created_at
      }),
      href: `/account/orders/${order.id}`
    }));

    return <AccountDataShell title="Receipts & documents" description="Recent order documents and payment summaries for your account." icon={Icon}>{documents.length ? <div className="account-detail-grid">{documents.map((document) => <div className="account-address-card" key={document.label}><strong>{document.documentType}</strong><span>{document.label}</span><span>{document.date}</span><span>{document.amount} · {document.status}</span><Link className="text-link" href={document.href}>View order <ArrowRight size={15} /></Link></div>)}</div> : <EmptyData text="No receipts or invoices yet." />}</AccountDataShell>;
  }
  return (
    <StorefrontShell>
      <main className="page-shell account-subpage">
        <Link className="back-link" href="/account"><ArrowLeft size={17} /> Back to My Dantown Hub</Link>
        <section className="account-subpage-card">
          <span className="account-subpage-icon"><Icon size={26} /></span>
          <p className="eyebrow">My Dantown Hub</p>
          <h1>{content.title}</h1>
          {content.status && <span className="account-feature-status">{content.status}</span>}
          <p>{content.description}</p>
          {content.action && <Link className="button button-primary" href={content.action.href}>{content.action.label} <ArrowRight size={16} /></Link>}
          {!content.action && <div className="empty-state"><h3>No updates yet.</h3><p>When this information is available for your account, it will appear here.</p></div>}
        </section>
      </main>
    </StorefrontShell>
  );
}

function AccountDataShell({ title, description, icon: Icon, children }: { title: string; description: string; icon: typeof Settings; children: ReactNode }) {
  return <StorefrontShell><main className="page-shell account-subpage"><Link className="back-link" href="/account"><ArrowLeft size={17} /> Back to My Dantown Hub</Link><section className="account-subpage-card account-data-card"><span className="account-subpage-icon"><Icon size={26} /></span><p className="eyebrow">My Dantown Hub</p><h1>{title}</h1><p>{description}</p>{children}</section></main></StorefrontShell>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div className="account-detail"><small>{label}</small><strong>{value}</strong></div>; }
function EmptyData({ text }: { text: string }) { return <div className="empty-state"><h3>{text}</h3><p>Information you add to your account will appear here.</p></div>; }

async function customerIdQuery(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, table: "orders" | "quotations") {
  const { data: customer } = await supabase.from("customers").select("id").eq("user_id", userId).maybeSingle();
  if (!customer) {
    return { count: 0 };
  }

  return supabase.from(table).select("id", { count: "exact", head: true }).eq("customer_id", customer.id);
}

async function customerAddressCountQuery(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) {
  const { data: customer } = await supabase.from("customers").select("id").eq("user_id", userId).maybeSingle();
  if (!customer) {
    return { count: 0 };
  }

  return supabase.from("customer_addresses").select("id", { count: "exact", head: true }).eq("customer_id", customer.id);
}
