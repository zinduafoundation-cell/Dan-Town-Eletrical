import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, CircleHelp, FileText, MapPin, Settings, ShieldCheck, Wrench } from "lucide-react";
import { StorefrontShell } from "@/components/storefront";
import { requireAuthenticated } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const sectionContent: Record<string, { title: string; description: string; icon: typeof Settings; status?: string; action?: { href: string; label: string } }> = {
  profile: { title: "My profile", description: "Keep your customer details up to date for orders, quotations, and delivery.", icon: Settings, action: { href: "#profile-details", label: "Profile details" } },
  quotations: { title: "Electrical quotations", description: "Request and review pricing for electrical materials, installations, and projects.", icon: FileText, action: { href: "/request-quote", label: "Request a quotation" } },
  projects: { title: "My electrical projects", description: "Project tracking is being prepared. Contact Dantown to discuss a current project or request help with your next one.", icon: Wrench, status: "Coming soon", action: { href: "/contact", label: "Contact Dantown" } },
  installations: { title: "Installation tracking", description: "Online visit and installation tracking is coming soon. Contact Dantown for updates on a scheduled installation.", icon: Wrench, status: "Coming soon", action: { href: "/contact", label: "Ask about an installation" } },
  "saved-products": { title: "Saved products", description: "Products you save while shopping will be ready here for your next project.", icon: ShieldCheck, action: { href: "/shop", label: "Explore electrical products" } },
  addresses: { title: "Delivery addresses", description: "Manage the addresses used for your Dantown deliveries and project visits.", icon: MapPin, action: { href: "#new-address", label: "Add an address" } },
  payments: { title: "Payment methods", description: "Payment options are confirmed securely during checkout.", icon: ShieldCheck, action: { href: "/shop", label: "Continue shopping" } },
  warranty: { title: "Warranty & documents", description: "Warranty records are not available in the account yet. Contact Dantown with your order details for help with an eligible product.", icon: FileText, status: "Coming soon", action: { href: "/contact", label: "Contact support" } },
  support: { title: "Help centre", description: "Get help with orders, delivery, products, installation, warranty, or quotations.", icon: CircleHelp, action: { href: "/contact", label: "Contact Dantown support" } },
  settings: { title: "Account preferences", description: "Manage notifications and account preferences securely.", icon: Settings, action: { href: "/account", label: "Back to My Dantown Hub" } }
};

export async function AccountSectionPage({ section }: { section: string }) {
  const context = await requireAuthenticated();
  const supabase = await createSupabaseServerClient();
  const content = sectionContent[section] ?? sectionContent.settings;
  const Icon = content.icon;
  if (section === "profile") {
    const [{ data: profile }, { data: customer }] = await Promise.all([
      supabase.from("profiles").select("full_name, phone, status").eq("id", context.userId).maybeSingle(),
      supabase.from("customers").select("name, email, phone, customer_type, status").eq("user_id", context.userId).maybeSingle()
    ]);
    return <AccountDataShell title="My profile" description="Your verified Dantown customer information." icon={Icon}><div className="account-detail-grid"><Detail label="Full name" value={profile?.full_name || customer?.name || "Not added"} /><Detail label="Email" value={customer?.email || "Not added"} /><Detail label="Phone" value={profile?.phone || customer?.phone || "Not added"} /><Detail label="Customer type" value={customer?.customer_type || "Retail"} /><Detail label="Account status" value={profile?.status || customer?.status || "Active"} /></div></AccountDataShell>;
  }
  if (section === "addresses") {
    const { data: customer } = await supabase.from("customers").select("id").eq("user_id", context.userId).maybeSingle();
    const { data: addresses } = customer ? await supabase.from("customer_addresses").select("id, label, recipient_name, phone, address_line_1, address_line_2, city, county, postal_code, is_default").eq("customer_id", customer.id).order("is_default", { ascending: false }) : { data: [] };
    return <AccountDataShell title="Delivery addresses" description="Saved delivery details for your Dantown orders." icon={Icon}>{addresses?.length ? <div className="account-detail-grid">{addresses.map((address) => <div className="account-address-card" key={address.id}><strong>{address.label}{address.is_default ? " · Default" : ""}</strong><span>{address.recipient_name} · {address.phone || "No phone"}</span><span>{address.address_line_1}{address.address_line_2 ? `, ${address.address_line_2}` : ""}</span><span>{[address.city, address.county, address.postal_code].filter(Boolean).join(", ")}</span></div>)}</div> : <EmptyData text="No delivery addresses saved yet." />}</AccountDataShell>;
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
