"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type Brand = { id: string; name: string; slug: string; description: string | null; logo_url: string | null; productCount: number };

export function BrandsBrowser({ brands }: { brands: Brand[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => { const normalized = query.trim().toLowerCase(); return brands.filter((brand) => !normalized || `${brand.name} ${brand.description ?? ""}`.toLowerCase().includes(normalized)); }, [brands, query]);
  return <><div className="brands-filter"><label htmlFor="brand-search">Find a brand</label><input id="brand-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search trusted makers" /><span>{filtered.length} of {brands.length}</span></div><div className="brand-grid brand-grid-enhanced">{filtered.map((brand) => <Link key={brand.slug} href={`/brands/${brand.slug}`} className="brand-card"><div className="brand-mark-wrapper">{brand.logo_url ? <Image src={brand.logo_url} alt={brand.name} fill sizes="(max-width: 760px) 100vw, 25vw" unoptimized /> : <span>{brand.name.charAt(0)}</span>}</div><p className="eyebrow">Brand partner</p><h3>{brand.name}</h3><p>{brand.description || "Explore products from this trusted electrical maker."}</p><span className="brand-product-count">{brand.productCount} live product{brand.productCount === 1 ? "" : "s"}</span><span className="text-link">View products →</span></Link>)}</div>{!filtered.length && <div className="empty-state"><h3>No brands match that search.</h3><p>Try another brand name.</p></div>}</>;
}
