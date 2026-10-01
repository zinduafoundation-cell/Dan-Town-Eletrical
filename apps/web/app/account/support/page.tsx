import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleHelp, FileText, Package, ShieldCheck, Truck, Wrench } from "lucide-react";
import { StorefrontShell } from "@/components/storefront";
import { requireAuthenticated } from "../../../lib/auth/server";

export const dynamic = "force-dynamic";

const supportLinks = [
  { title: "Order help", description: "Track purchases, payment status, and order details.", href: "/account/orders", icon: Package },
  { title: "Quotation help", description: "Request project pricing or review your quotations.", href: "/request-quote", icon: FileText },
  { title: "Delivery help", description: "Learn about delivery areas, timing, and collection.", href: "/delivery", icon: Truck },
  { title: "Installation help", description: "Talk to the Dantown team about an electrical project.", href: "/services", icon: Wrench },
  { title: "Warranty help", description: "Ask about product warranty and after-sales support.", href: "/account/warranty", icon: ShieldCheck },
  { title: "Contact Dantown", description: "Send a direct support request to the team.", href: "/contact", icon: CircleHelp }
];

export default async function SupportPage() {
  await requireAuthenticated();
  return <StorefrontShell><main className="page-shell account-subpage"><Link className="back-link" href="/account"><ArrowLeft size={17} /> Back to My Dantown Hub</Link><div className="account-support-heading"><p className="eyebrow">My Dantown Hub</p><h1>Help Centre</h1><p>Find the right path for orders, products, installations, quotations, and warranty support.</p></div><div className="support-option-grid">{supportLinks.map(({ title, description, href, icon: Icon }) => <Link className="support-option" href={href} key={title}><span><Icon size={20} /></span><div><strong>{title}</strong><small>{description}</small></div><ArrowRight size={16} /></Link>)}</div></main></StorefrontShell>;
}
