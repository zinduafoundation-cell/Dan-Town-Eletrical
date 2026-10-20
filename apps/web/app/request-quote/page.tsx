import type { Metadata } from "next";
import { StorefrontShell } from "@/components/storefront";
import { RequestQuoteForm } from "@/components/account/request-quote-form";

export const metadata: Metadata = {
  title: "Request a quote",
  description: "Share your project requirements and receive a tailored quote from Dantown.",
};

export default function RequestQuotePage() {
  return (
    <StorefrontShell>
      <section className="page-shell quote-page-shell">
        <div className="page-hero compact">
          <div><p className="eyebrow">Request a quote</p><h1>Tell us about your project.</h1></div>
        </div>
        <RequestQuoteForm />
      </section>
    </StorefrontShell>
  );
}
