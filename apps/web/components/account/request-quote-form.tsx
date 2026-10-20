"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function RequestQuoteForm() {
  const router = useRouter();
  const [requirements, setRequirements] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/account/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requirements, company }),
      });
      const result = await response.json();
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/request-quote")}`);
        return;
      }
      if (!response.ok) throw new Error(result.error || "Unable to send your quote request.");
      setQuoteNumber(result.quoteNumber);
      setRequirements("");
      setCompany("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send your quote request.");
    } finally {
      setSaving(false);
    }
  }

  if (quoteNumber) {
    return (
      <div className="quote-request-success" role="status">
        <h2>Quote request received</h2>
        <p>Reference: <strong>{quoteNumber}</strong>. We’ll notify you when your quotation is ready.</p>
        <Link className="button button-primary" href="/account/quotes">View my quotations</Link>
      </div>
    );
  }

  return (
    <form className="quote-form" onSubmit={submit}>
      <p>Sign in to save this request securely to your account and receive updates.</p>
      <div className="field-grid">
        <label>
          <span>Company or project name</span>
          <input value={company} onChange={(event) => setCompany(event.target.value)} maxLength={160} placeholder="Optional" />
        </label>
      </div>
      <label>
        <span>Project requirements</span>
        <textarea
          rows={6}
          value={requirements}
          onChange={(event) => setRequirements(event.target.value)}
          minLength={10}
          maxLength={3000}
          required
          placeholder="Tell us about the materials, quantities, installation scope, and timeline."
        />
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button type="submit" className="button button-primary" disabled={saving}>
        {saving ? "Sending request…" : "Submit quote request"}
      </button>
    </form>
  );
}
