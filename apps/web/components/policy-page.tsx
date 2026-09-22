import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { StorefrontShell } from "@/components/storefront";

const policyLinks = [
  ["Shipping", "/shipping"],
  ["Delivery", "/delivery"],
  ["Returns", "/returns"],
  ["Warranty", "/warranty"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Cookies", "/cookies"]
] as const;

export function PolicyPage({
  eyebrow,
  title,
  intro,
  sections
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
}) {
  return (
    <StorefrontShell>
      <main className="policy-page page-shell">
        <Link className="back-link" href="/">
          <ArrowRight size={17} className="policy-back-icon" /> Back to Dantown
        </Link>
        <header className="policy-hero">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{intro}</p>
        </header>
        <nav className="policy-nav" aria-label="Dantown policy pages">
          {policyLinks.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>
        <div className="policy-grid">
          {sections.map((section) => (
            <section className="policy-card" key={section.title}>
              <CheckCircle2 size={20} />
              <div><h2>{section.title}</h2><p>{section.body}</p></div>
            </section>
          ))}
        </div>
        <div className="policy-contact">
          <strong>Need help with an order?</strong>
          <p>Our Kitale team can clarify delivery, payment, warranty, or return questions.</p>
          <Link className="text-link" href="/contact">Contact Dantown <ArrowRight size={16} /></Link>
        </div>
      </main>
    </StorefrontShell>
  );
}
