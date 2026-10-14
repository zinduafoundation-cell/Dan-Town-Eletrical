import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StorefrontShell } from "@/components/storefront";
import { policies, policyGroups, policyLastUpdated } from "@/lib/policies/config";

export const metadata: Metadata = {
  title: "Policies | Dantown Electrical",
  description: "Draft customer, payment, privacy, and legal policies for review."
};

export default function PoliciesPage() {
  return (
    <StorefrontShell>
      <main className="policy-page policies-hub page-shell">
        <header className="policy-hero">
          <p className="eyebrow">Dantown policies</p>
          <h1>Policies &amp; customer information</h1>
          <p>Browse draft policy information. These pages are not final and require business confirmation and legal review before publication.</p>
          <p className="policy-updated">Last updated: {policyLastUpdated}</p>
        </header>
        {policyGroups.map((group) => (
          <section className="policy-group" key={group}>
            <h2>{group}</h2>
            <div className="policy-card-grid">
              {policies.filter((policy) => policy.group === group).map((policy) => (
                <Link className="policy-hub-card" href={`/policies/${policy.slug}`} key={policy.slug}>
                  <span><strong>{policy.title}</strong><ArrowRight size={17} /></span>
                  <p>{policy.summary}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
        <p className="policy-placeholder-note">Business and legal details in draft pages are marked with placeholders. They must be completed and approved before these policies are treated as final.</p>
      </main>
    </StorefrontShell>
  );
}
