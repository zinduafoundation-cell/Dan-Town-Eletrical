import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleHelp, FileText } from "lucide-react";
import { StorefrontShell } from "@/components/storefront";
import { getRelatedPolicies, policyLastUpdated, type Policy } from "@/lib/policies/config";

export function PolicyPage({ policy }: { policy: Policy }) {
  const related = getRelatedPolicies(policy);

  return (
    <StorefrontShell>
      <main className="policy-page page-shell">
        <Link className="back-link" href="/policies"><ArrowLeft size={17} /> Back to Policies</Link>
        <header className="policy-hero">
          <p className="eyebrow">{policy.group}</p>
          <h1>{policy.title}</h1>
          <p className="policy-updated">Last updated: {policyLastUpdated}</p>
        </header>
        <section className="policy-summary-card">
          <span className="policy-icon"><FileText size={22} /></span>
          <div>
            <p className="eyebrow">Draft for review</p>
            <p>{policy.summary}</p>
            <strong>Not final: this draft needs business confirmation and legal review before publication.</strong>
          </div>
        </section>
        <section className="policy-sections" aria-label={`${policy.title} sections`}>
          {policy.sections.map((section, index) => (
            <details className="policy-section" key={section.title} open={index === 0}>
              <summary>{section.title}</summary>
              <p>{section.body}</p>
            </details>
          ))}
        </section>
        <nav className="policy-related" aria-label="Related policies">
          <p className="eyebrow">Related policies</p>
          <div>{related.map((item) => <Link className="policy-related-link" href={`/policies/${item.slug}`} key={item.slug}>{item.title}<ArrowRight size={15} /></Link>)}</div>
        </nav>
        <aside className="policy-support-card">
          <CircleHelp size={22} />
          <div>
            <h2>Need help?</h2>
            <p>For an existing order or question, use the current support page. Confirm the approved contact details before publishing this draft.</p>
            <Link className="text-link" href="/contact">Open support <ArrowRight size={15} /></Link>
          </div>
        </aside>
      </main>
    </StorefrontShell>
  );
}
