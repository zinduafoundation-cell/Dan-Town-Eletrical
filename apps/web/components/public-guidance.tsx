"use client";

import { HelpCircle, X } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const TOUR_KEY = "dantown-public-tour-v1";

const pageGuidance: Record<string, { title: string; body: string }> = {
  "/": { title: "Start from the home page", body: "Use the menu to browse Shop, Electrical, Solar, Services and Deals. Search is available in the header; Support and DAN T AI can help if you get stuck." },
  "/shop": { title: "Browse products", body: "Search or use categories and filters to find products. Open a product for details, then add it to your cart." },
  "/categories": { title: "Browse by category", body: "Choose an electrical or solar category to narrow the catalogue, then open a product to compare its details." },
  "/cart": { title: "Review your cart", body: "Adjust quantities, remove items, check your subtotal and continue to checkout when ready." },
  "/checkout": { title: "Complete your order", body: "Enter your contact details, choose delivery or pickup, confirm the order summary, then continue to the secure payment page." },
  "/payment": { title: "Choose how to pay", body: "Select an available payment method and follow the secure checkout. Keep your order number so you can check its status later." },
  "/order-confirmation": { title: "Check your order status", body: "This page shows whether payment is pending or confirmed and the latest order status. Save your order number for support." },
  "/account/orders": { title: "Track your orders", body: "Sign in to view your orders and follow progress from order received through processing and delivery or pickup." },
  "/solar": { title: "Plan your solar setup", body: "Explore solar products and solutions, use the Solar Advisor, or request a tailored quotation." },
  "/services": { title: "Find a service", body: "Explore installation, maintenance, repairs and consultation, or contact Dantown for a site assessment." },
  "/account": { title: "Manage your account", body: "View orders, saved details, addresses, notifications and support options from your account." }
};

const guidedSteps = [
  {
    title: "Find your way around",
    body: "Use the menu to explore products, solar, electrical services, projects and deals. Search the catalogue or open Help whenever you need directions.",
    href: "/",
    linkLabel: "Visit the home page"
  },
  {
    title: "Browse and choose products",
    body: "Shop and category pages help you find products. Open an item for its details, then add it to your cart.",
    href: "/shop",
    linkLabel: "Explore the shop"
  },
  {
    title: "Review your cart",
    body: "Check products and quantities in your cart. When everything looks right, continue to checkout.",
    href: "/cart",
    linkLabel: "Open the cart"
  },
  {
    title: "Place and pay for an order",
    body: "At checkout, enter contact details and choose delivery or pickup. Continue to payment, then keep the order number shown in your confirmation.",
    href: "/checkout",
    linkLabel: "See checkout"
  },
  {
    title: "Follow order progress",
    body: "The order-status page shows payment and fulfillment updates. Sign in to your account to find your order history, saved details and notifications.",
    href: "/account",
    linkLabel: "Explore your account"
  }
];

export function PublicGuidance({ showLauncher = true }: { showLauncher?: boolean }) {
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourSeen, setTourSeen] = useState(true);
  const [tourStep, setTourStep] = useState(0);
  const page = useMemo(() => pageGuidance[pathname] ?? pageGuidance["/"], [pathname]);
  const guide = guidedSteps[tourStep] ?? guidedSteps[0];

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
        <div className="guidance-welcome" role="dialog" aria-modal="true" aria-labelledby="guidance-title" aria-describedby="guidance-description">
          <button className="guidance-close" type="button" onClick={finishTour} aria-label="Skip tour"><X size={18} /></button>
          <span className="guidance-icon">?</span>
          <p className="eyebrow">CUSTOMER GUIDE · STEP {tourStep + 1} OF {guidedSteps.length}</p>
          <h2 id="guidance-title">{guide.title}</h2>
          <p id="guidance-description">{guide.body}</p>
          <Link className="guidance-step-link" href={guide.href} onClick={finishTour}>{guide.linkLabel} <span aria-hidden="true">→</span></Link>
          <div className="guidance-actions">
            {tourStep > 0 ? <button type="button" className="button button-secondary" onClick={() => setTourStep((step) => step - 1)}>Back</button> : null}
            {tourStep < guidedSteps.length - 1 ? (
              <button type="button" className="button button-primary" onClick={() => setTourStep((step) => step + 1)}>Next tip</button>
            ) : (
              <button type="button" className="button button-primary" onClick={finishTour}>Start exploring</button>
            )}
            <button type="button" className="button button-secondary" onClick={finishTour}>Skip guide</button>
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
