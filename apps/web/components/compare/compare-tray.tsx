"use client";

import Link from "next/link";
import { GitCompareArrows, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCompare } from "@/lib/compare";

const HIDDEN = ["/compare", "/pos", "/admin", "/business-center", "/staff", "/login", "/register", "/checkout", "/payment"];

/** Slim bar that appears as soon as a shopper picks a product to compare. */
export function CompareTray() {
  const pathname = usePathname();
  const { slugs, clear } = useCompare();
  if (!slugs.length || HIDDEN.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;

  return (
    <aside className="compare-tray" aria-label="Product comparison">
      <GitCompareArrows size={18} aria-hidden="true" />
      <span><strong>{slugs.length}</strong> {slugs.length === 1 ? "product" : "products"} selected{slugs.length < 2 ? " · add one more" : ""}</span>
      <Link className="button button-primary" href={`/compare?items=${encodeURIComponent(slugs.join(","))}`} aria-disabled={slugs.length < 2} onClick={(event) => { if (slugs.length < 2) event.preventDefault(); }}>Compare now</Link>
      <button type="button" onClick={clear} aria-label="Clear comparison"><X size={16} /></button>
    </aside>
  );
}
