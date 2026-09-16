import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleHelp, FileText, MapPin, Settings, ShieldCheck, Wrench } from "lucide-react";
import { StorefrontShell } from "@/components/storefront";
import { requireAuthenticated } from "@/lib/auth/server";

const sectionContent: Record<string, { title: string; description: string; icon: typeof Settings; action?: { href: string; label: string } }> = {
  profile: { title: "My profile", description: "Keep your customer details up to date for orders, quotations, and delivery.", icon: Settings, action: { href: "#profile-details", label: "Profile details" } },
  quotations: { title: "Electrical quotations", description: "Request and review pricing for electrical materials, installations, and projects.", icon: FileText, action: { href: "/request-quote", label: "Request a quotation" } },
  projects: { title: "My electrical projects", description: "Project milestones and installation progress will appear here as your Dantown team updates them.", icon: Wrench },
  installations: { title: "Installation tracking", description: "Follow scheduled site visits, installation teams, and completion updates from one place.", icon: Wrench },
  "saved-products": { title: "Saved products", description: "Products you save while shopping will be ready here for your next project.", icon: ShieldCheck, action: { href: "/shop", label: "Explore electrical products" } },
  addresses: { title: "Delivery addresses", description: "Manage the addresses used for your Dantown deliveries and project visits.", icon: MapPin, action: { href: "#new-address", label: "Add an address" } },
  payments: { title: "Payment methods", description: "Payment options are confirmed securely during checkout.", icon: ShieldCheck, action: { href: "/shop", label: "Continue shopping" } },
  warranty: { title: "Warranty & documents", description: "Warranty records and documents for eligible purchases will appear here.", icon: FileText },
  support: { title: "Help centre", description: "Get help with orders, delivery, products, installation, warranty, or quotations.", icon: CircleHelp, action: { href: "/contact", label: "Contact Dantown support" } },
  settings: { title: "Account preferences", description: "Manage notifications and account preferences securely.", icon: Settings, action: { href: "/account", label: "Back to My Dantown Hub" } }
};

export async function AccountSectionPage({ section }: { section: string }) {
  await requireAuthenticated();
  const content = sectionContent[section] ?? sectionContent.settings;
  const Icon = content.icon;
  return (
    <StorefrontShell>
      <main className="page-shell account-subpage">
        <Link className="back-link" href="/account"><ArrowLeft size={17} /> Back to My Dantown Hub</Link>
        <section className="account-subpage-card">
          <span className="account-subpage-icon"><Icon size={26} /></span>
          <p className="eyebrow">My Dantown Hub</p>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
          {content.action && <Link className="button button-primary" href={content.action.href}>{content.action.label} <ArrowRight size={16} /></Link>}
          {!content.action && <div className="empty-state"><h3>No updates yet.</h3><p>When this information is available for your account, it will appear here.</p></div>}
        </section>
      </main>
    </StorefrontShell>
  );
}
