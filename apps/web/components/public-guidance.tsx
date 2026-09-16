"use client";

import { HelpCircle, X } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const TOUR_KEY = "dantown-public-tour-v1";

const pageGuidance: Record<string, { title: string; body: string }> = {
  "/": { title: "Start with search or Shop", body: "Search the catalogue, browse categories, use the solar and services pages, or ask DAN T AI for help." },
  "/shop": { title: "Browse the catalogue", body: "Use search, filters and sorting to find products, then add them to your cart or order directly." },
  "/cart": { title: "Review your cart", body: "Adjust quantities, remove items, check your subtotal and continue to checkout when ready." },
  "/checkout": { title: "Complete your order", body: "Confirm your saved customer details, choose delivery or pickup, then continue to payment." },
  "/solar": { title: "Plan your solar setup", body: "Explore solar products and solutions, use the Solar Advisor, or request a tailored quotation." },
  "/services": { title: "Find a service", body: "Explore installation, maintenance, repairs and consultation, or contact Dantown for a site assessment." },
  "/account": { title: "Manage your account", body: "View orders, saved details, addresses, notifications and support options from your account." }
};

export function PublicGuidance({ showLauncher = true }: { showLauncher?: boolean }) {
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourSeen, setTourSeen] = useState(true);
  const page = useMemo(() => pageGuidance[pathname] ?? pageGuidance["/"], [pathname]);

  useEffect(() => {
    const seen = window.localStorage.getItem(TOUR_KEY);
    if (!seen) {
      const timer = window.setTimeout(() => {
        setTourSeen(false);
        setTourOpen(true);
      }, 900);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    function openHelp() {
      setHelpOpen(true);
    }
    window.addEventListener("dantown-open-help", openHelp);
    return () => window.removeEventListener("dantown-open-help", openHelp);
  }, []);

  function finishTour() {
    window.localStorage.setItem(TOUR_KEY, "seen");
    setTourSeen(true);
    setTourOpen(false);
  }

  return (
    <>
      {!tourSeen && tourOpen ? (
        <div className="guidance-welcome" role="dialog" aria-modal="true" aria-labelledby="guidance-title">
          <button className="guidance-close" type="button" onClick={finishTour} aria-label="Skip tour"><X size={18} /></button>
          <span className="guidance-icon">?</span>
          <p className="eyebrow">Welcome to Dantown</p>
          <h2 id="guidance-title">Let&apos;s make finding the right product easy.</h2>
          <p>Search the catalogue, compare products, get advice and complete your order in a few simple steps.</p>
          <div className="guidance-actions">
            <button type="button" className="button button-primary" onClick={finishTour}>Start exploring</button>
            <button type="button" className="button button-secondary" onClick={finishTour}>Skip</button>
          </div>
        </div>
      ) : null}

      {helpOpen ? (
        <aside className="guidance-help-panel" aria-label="Dantown help">
          <div className="guidance-help-header">
            <div><strong>How can we help?</strong><small>{page.title}</small></div>
            <button type="button" onClick={() => setHelpOpen(false)} aria-label="Close help"><X size={17} /></button>
          </div>
          <p>{page.body}</p>
          <div className="guidance-help-links">
            <a href="/contact">How do I place an order?</a>
            <a href="/request-quote">How do I request a quotation?</a>
            <a href="/delivery">How does delivery work?</a>
            <a href="/solar-calculator">How do I choose a solar system?</a>
            <Link href="/account/orders">How do I track my order?</Link>
          </div>
          <button type="button" className="guidance-ai-link" onClick={() => { setHelpOpen(false); document.querySelector<HTMLButtonElement>(".dan-ai-launcher")?.click(); }}>Ask DAN T AI</button>
        </aside>
      ) : null}
      {showLauncher ? <button className="guidance-help-button" type="button" onClick={() => setHelpOpen((open) => !open)} aria-expanded={helpOpen} aria-label="Open Dantown help">
        <HelpCircle size={18} /><span>Help</span>
      </button> : null}
    </>
  );
}
