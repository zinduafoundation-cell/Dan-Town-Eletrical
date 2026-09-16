import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sun } from "lucide-react";
import { StorefrontShell } from "@/components/storefront";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getDivisionCategories, solarCategorySeeds } from "@/lib/division-data";

export const metadata: Metadata = { title: "Solar Division", description: "Explore Dantown Electrical solar products and clean energy solutions." };

export default async function SolarDivisionPage() {
  const categories = await getDivisionCategories(createSupabaseServiceClient(), solarCategorySeeds);
  return <StorefrontShell><section className="division-page division-solar"><div className="division-hero"><div><p className="eyebrow">Dantown Electrical / Solar</p><h1>Solar Division</h1><p>Powering Kenya with clean solar energy, practical storage, and reliable backup solutions.</p><div className="hero-actions"><Link href="/solar-calculator" className="button button-secondary">Use Solar Advisor</Link><Link href="/request-quote" className="text-link">Request a system quote <ArrowRight size={16} /></Link></div></div><span className="division-hero-icon"><Sun size={62} strokeWidth={1.2} /></span></div><div className="division-heading"><div><p className="eyebrow">Explore the range</p><h2>Start with the system you are building.</h2></div><span>{categories.length ? `${categories.length} live categories` : "Categories are being prepared"}</span></div>{categories.length ? <div className="division-category-grid">{categories.map((category) => <Link className="division-category-card" href={`/categories/${category.slug}`} key={category.slug}>{category.imageUrl ? <div className="division-category-image" style={{ backgroundImage: `url(${category.imageUrl})` }} /> : <div className="division-category-image division-category-placeholder"><Sun size={28} /></div>}<div><h3>{category.name}</h3><p>{category.description}</p><small>{category.productCount ? `${category.productCount} live products` : "Explore available products"}<ArrowRight size={14} /></small></div></Link>)}</div> : <div className="empty-state"><h3>No live solar categories yet.</h3><p>Use the product intake workflow to add approved solar categories and products.</p></div>}</section></StorefrontShell>;
}
