/* eslint-disable @next/next/no-img-element -- Match previews use administrator-supplied remote catalog URLs and need to remain usable without a restrictive build-time host allowlist. */
"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileSearch, ImagePlus, LoaderCircle, Search, ShieldCheck, Sparkles, Upload, X, PackageCheck, ArrowRight } from "lucide-react";
import { useCart } from "@/components/cart/cart-context";
import { formatCurrency } from "@/lib/store-data";

type Product = {
  id: string;
  name: string;
  sku: string;
  slug: string;
  retailPrice: number;
  imageUrl: string | null;
  brandName: string | null;
  categoryName: string | null;
  availableQuantity: number;
};
type Match = {
  requestedName: string;
  requestedQuantity: number;
  status: "AVAILABLE" | "PARTIALLY_AVAILABLE" | "OUT_OF_STOCK" | "NOT_FOUND" | "ALTERNATIVE_AVAILABLE";
  confidence: number;
  product: Product | null;
  alternatives: Product[];
  extracted?: { brand?: string | null; model?: string | null; specifications?: Record<string, string>; unit?: string };
};

export function SmartMatchClient() {
  const cart = useCart();
  const quotationRef = useRef<HTMLInputElement>(null);
  const productRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [searchResults, setSearchResults] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fileName, setFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [requestQuote, setRequestQuote] = useState(false);
  const [quoteSent, setQuoteSent] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [contact, setContact] = useState({ name: "", phone: "", email: "", notes: "" });

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function searchProducts(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!query.trim()) return;
    setError("");
    setFileName("");
    setPreviewUrl("");
    setResults([]);
    setSearchResults([]);
    setLoading(true);
    try {
      const response = await fetch(`/api/ai/smart-match?query=${encodeURIComponent(query.trim())}`);
      const body = await response.json() as { matches?: Match[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Search is temporarily unavailable.");
      setSearchResults(body.matches ?? []);
      setResults([]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Search is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  async function scanFile(event: ChangeEvent<HTMLInputElement>, kind: "quotation" | "product") {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setNotice("");
    setQuoteError("");
    setFileName(file.name);
    setResults([]);
    setSearchResults([]);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);
    try {
      const response = await fetch("/api/ai/smart-match", { method: "POST", body: formData });
      const body = await response.json() as { matches?: Match[]; error?: string; message?: string };
      if (!response.ok) throw new Error(body.error || "The file could not be analyzed.");
      setResults(body.matches ?? []);
      setSearchResults([]);
      setNotice(body.message || "Your file has been analyzed against the Dantown catalogue.");
    } catch (requestError) {
      setError(requestError instanceof Error && (requestError.name === "AbortError" || requestError.name === "TimeoutError")
        ? "The scan took too long. Try a smaller or clearer file, or use manual search."
        : requestError instanceof Error ? requestError.message : "The file could not be analyzed.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  function addProduct(product: Product, quantity: number) {
    if (quantity < 1 || product.availableQuantity < 1) return;
    const safeQuantity = Math.min(Math.floor(quantity), product.availableQuantity);
    cart.addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      sku: product.sku,
      unitPrice: product.retailPrice,
      imageUrl: product.imageUrl,
      quantity: safeQuantity,
      stockStatus: product.availableQuantity > safeQuantity ? "In stock" : "Low stock",
    });
    setNotice(`${safeQuantity} × ${product.name} added to your cart.`);
  }

  function addAvailableItems() {
    const available = results.filter((match) => match.product && match.status === "AVAILABLE");
    if (!available.length) {
      setNotice("There are no fully available items to add. You can add partial quantities below.");
      return;
    }
    for (const match of available) addProduct(match.product!, match.requestedQuantity);
  }

  async function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuoteLoading(true);
    setQuoteError("");
    setQuoteSent("");
    try {
      const response = await fetch("/api/ai/smart-match/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...contact,
          items: results.map(({ requestedName, requestedQuantity }) => ({ requestedName, requestedQuantity })),
        }),
      });
      const body = await response.json() as { requestId?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Your quote request could not be submitted.");
      setQuoteSent(`Request ${body.requestId} has been sent to the Dantown team.`);
      setRequestQuote(false);
    } catch (requestError) {
      setQuoteError(requestError instanceof Error ? requestError.message : "Your quote request could not be submitted.");
    } finally {
      setQuoteLoading(false);
    }
  }

  const displayed = results.length ? results : searchResults;
  return (
    <main className="page-shell smart-match-page">
      <section className="smart-match-hero">
        <div>
          <p className="eyebrow"><Sparkles size={15} /> Dantown AI Smart Match</p>
          <h1>Find it with Dantown AI.</h1>
          <p>Upload a quotation or take a photo of a product. We&apos;ll check it against products Dantown actually carries.</p>
        </div>
        <div className="smart-match-hero-badge"><ShieldCheck size={19} /><span>Real catalogue data<br /><small>No invented stock or prices</small></span></div>
      </section>

      <section className="smart-match-actions">
        <input ref={quotationRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,application/pdf,image/jpeg,image/png,image/webp" hidden onChange={(event) => void scanFile(event, "quotation")} />
        <input ref={productRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(event) => void scanFile(event, "product")} />
        <button type="button" className="smart-match-card" onClick={() => quotationRef.current?.click()} disabled={loading}>
          <span className="smart-match-icon"><FileSearch size={25} /></span>
          <strong>Scan a quotation</strong>
          <p>Upload a quotation, invoice, list or screenshot and we&apos;ll find the closest catalogue matches.</p>
          <small>JPG · PNG · WEBP · PDF <Upload size={15} /></small>
        </button>
        <button type="button" className="smart-match-card" onClick={() => productRef.current?.click()} disabled={loading}>
          <span className="smart-match-icon"><ImagePlus size={25} /></span>
          <strong>Scan a product</strong>
          <p>Take a clear photo of the label, model number or product and check Dantown availability.</p>
          <small>Camera on mobile · JPG · PNG · WEBP <Upload size={15} /></small>
        </button>
      </section>

      <section className="smart-match-manual">
        <div><p className="eyebrow">Or search manually</p><h2>Tell us what you need.</h2></div>
        <form onSubmit={(event) => void searchProducts(event)}>
          <Search size={18} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. 5kW hybrid inverter or 2.5mm cable" aria-label="Search Dantown products" />
          <button type="submit" disabled={loading || !query.trim()}>{loading ? <LoaderCircle className="spin" size={17} /> : "Search"}</button>
        </form>
      </section>

      {loading && <div className="smart-match-scanning" role="status"><LoaderCircle className="spin" size={20} /> {fileName ? "Analyzing your file against the catalogue..." : "Searching live Dantown products..."}</div>}
      {fileName && <div className="smart-match-file"><FileSearch size={16} /> {fileName} <button type="button" onClick={() => { setFileName(""); setPreviewUrl(""); setResults([]); setError(""); }} aria-label="Clear file"><X size={15} /></button></div>}
      {error && <div className="smart-match-error" role="alert">{error}</div>}
      {notice && <div className="smart-match-notice" role="status">{notice}</div>}
      {quoteSent && <div className="smart-match-notice" role="status">{quoteSent}</div>}
      {quoteError && <div className="smart-match-error" role="alert">{quoteError}</div>}
      {previewUrl && !displayed.length && <aside className="smart-match-preview smart-match-preview-standalone">
        <div><p className="eyebrow">Your upload</p><strong>{fileName}</strong></div>
        {fileName.toLowerCase().endsWith(".pdf") ? <iframe src={previewUrl} title="Quotation preview" /> : <img src={previewUrl} alt="Preview of the uploaded product or quotation image" />}
        <p>Your original file is sent to the configured AI provider for analysis and is not saved to your Dantown account.</p>
      </aside>}

      {displayed.length > 0 && <section className={previewUrl ? "smart-match-results smart-match-workspace" : "smart-match-results"}>
        {previewUrl && <aside className="smart-match-preview">
          <div><p className="eyebrow">Your upload</p><strong>{fileName}</strong></div>
          {fileName.toLowerCase().endsWith(".pdf") ? <iframe src={previewUrl} title="Quotation preview" /> : <img src={previewUrl} alt="Preview of the uploaded product or quotation image" />}
          <p>Your original file is sent to the configured AI provider for analysis and is not saved to your Dantown account.</p>
        </aside>}
        <div className="smart-match-result-column">
          <div className="smart-match-results-heading"><div><p className="eyebrow">Found in Dantown</p><h2>{results.length ? "Your quotation has been analyzed." : "Matching products"}</h2></div>
            {results.length > 0 && <div className="smart-match-result-tools"><button type="button" className="button button-secondary" onClick={addAvailableItems}><PackageCheck size={16} /> Add available items</button><Link className="button button-secondary" href="/cart">View cart ({cart.getTotalCount()}) <ArrowRight size={16} /></Link></div>}
          </div>
          <div className="smart-match-list">
            {displayed.map((match, index) => <article className="smart-match-result" key={`${match.requestedName}-${index}`}>
              <div className="smart-match-result-image">{match.product?.imageUrl ? <span style={{ backgroundImage: `url(${match.product.imageUrl})` }} /> : <ImagePlus size={22} />}</div>
              <div className="smart-match-result-copy">
                <span className={`smart-status ${match.status.toLowerCase()}`}>{match.status.replaceAll("_", " ")}</span>
                <h3>{match.product?.name || match.requestedName}</h3>
                <p>{match.product?.brandName || match.extracted?.brand || "Dantown catalogue match"}{match.product?.categoryName ? ` · ${match.product.categoryName}` : ""} · Requested: {match.requestedQuantity} {match.extracted?.unit ?? ""}</p>
                {match.extracted?.model && <small>Model noted: {match.extracted.model} · </small>}
                <small>Catalogue text match: {Math.round(match.confidence * 100)}% · Available: {match.product?.availableQuantity ?? 0}</small>
                {match.extracted?.specifications && Object.keys(match.extracted.specifications).length > 0 && <small className="smart-specs">{Object.entries(match.extracted.specifications).map(([key, value]) => `${key}: ${value}`).join(" · ")}</small>}
                {match.alternatives.length > 0 && <details className="smart-alternatives"><summary>Find an alternative ({match.alternatives.length})</summary>{match.alternatives.map((alternative) => <div key={alternative.id}><Link href={`/products/${alternative.slug}`}>{alternative.name}</Link><span>{alternative.availableQuantity} available · {formatCurrency(alternative.retailPrice)}</span><button type="button" onClick={() => addProduct(alternative, Math.min(match.requestedQuantity, alternative.availableQuantity))} disabled={alternative.availableQuantity < 1}>Add</button></div>)}</details>}
              </div>
              <div className="smart-match-result-action">{match.product ? <><strong>{formatCurrency(match.product.retailPrice)}</strong><small>{match.product.availableQuantity} available</small><button className="button button-primary" type="button" onClick={() => addProduct(match.product!, match.requestedQuantity)} disabled={match.product.availableQuantity < 1}>{match.status === "PARTIALLY_AVAILABLE" ? `Add ${match.product.availableQuantity}` : match.product.availableQuantity ? `Add ${Math.min(match.requestedQuantity, match.product.availableQuantity)}` : "Out of stock"}</button><Link href={`/products/${match.product.slug}`}>View product</Link></> : <span>No confident catalogue match. Add this request to a quote.</span>}</div>
            </article>)}
          </div>
          {results.length > 0 && <div className="smart-match-quote-cta"><div><strong>Need a larger order or an alternative?</strong><p>Send the detected items to our team and we&apos;ll follow up.</p></div><button type="button" className="button button-secondary" onClick={() => setRequestQuote((open) => !open)}>{requestQuote ? "Close quote form" : "Request a Dantown quote"}</button></div>}
          {requestQuote && <form className="smart-match-quote-form" onSubmit={(event) => void submitQuote(event)}>
            <h3>Where can our team reach you?</h3>
            <div className="smart-match-quote-fields"><label>Name<input required maxLength={120} value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} /></label><label>Phone<input type="tel" required maxLength={30} value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} /></label><label>Email (optional)<input type="email" maxLength={254} value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} /></label></div>
            <label>Additional notes<textarea rows={3} maxLength={500} value={contact.notes} onChange={(event) => setContact({ ...contact, notes: event.target.value })} /></label>
            <button className="button button-primary" type="submit" disabled={quoteLoading}>{quoteLoading ? "Sending request..." : "Send quote request"}</button>
          </form>}
        </div>
      </section>}
    </main>
  );
}
