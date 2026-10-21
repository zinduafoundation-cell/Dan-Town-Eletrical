"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";

type Brand = { id: string; name: string; slug: string; description: string | null; logo_url: string | null; productCount: number };

export function BrandsBrowser({ brands }: { brands: Brand[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return brands.filter((brand) => !normalized || `${brand.name} ${brand.description ?? ""}`.toLowerCase().includes(normalized));
  }, [brands, query]);

  return (
    <>
      <div className="brands-filter">
        <label htmlFor="brand-search">Find a brand</label>
        <input
          id="brand-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search trusted makers"
        />
        <span aria-live="polite">{filtered.length} of {brands.length} brands</span>
      </div>
      <div className="brand-grid brand-grid-enhanced">
        {filtered.map((brand) => (
          <Link key={brand.slug} href={`/brands/${brand.slug}`} className="brand-card">
            <div className="brand-card-logo-frame">
              {brand.logo_url
                ? <Image src={brand.logo_url} alt={`${brand.name} logo`} fill sizes="(max-width: 560px) 90vw, (max-width: 900px) 44vw, 22vw" unoptimized />
                : <span aria-hidden="true">{brand.name.charAt(0)}</span>}
            </div>
            <div className="brand-card-heading">
              <div>
                <p className="eyebrow">Brand partner</p>
                <h3>{brand.name}</h3>
              </div>
              <span className="brand-card-arrow" aria-hidden="true"><ArrowUpRight size={18} strokeWidth={2.2} /></span>
            </div>
            <p className="brand-card-description">{brand.description || "Explore products from this trusted electrical maker."}</p>
            <span className="brand-product-count">{brand.productCount} live product{brand.productCount === 1 ? "" : "s"}</span>
          </Link>
        ))}
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <h3>No brands match that search.</h3>
          <p>Try another brand name.</p>
        </div>
      )}
    </>
  );
}
