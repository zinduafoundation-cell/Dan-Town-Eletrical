import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Cable } from "lucide-react";
import { StorefrontShell } from "@/components/storefront";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { electricalCategorySeeds, getDivisionCategories } from "@/lib/division-data";

export const metadata: Metadata = { title: "Electrical Division", description: "Explore Dantown Electrical products for homes, businesses, and professional projects." };

export default async function ElectricalDivisionPage() {
  const categories = await getDivisionCategories(createSupabaseServiceClient(), electricalCategorySeeds);
  return <StorefrontShell><section className="division-page division-electrical"><div className="division-hero"><div><p className="eyebrow">Dantown Electrical / Electrical</p><h1>Electrical Division</h1><p>Professional electrical solutions for every build, from everyday repairs to coordinated project supply.</p><div className="hero-actions"><Link href="/shop" className="button button-primary">Shop electrical products</Link><Link href="/request-quote" className="text-link">Request project supply <ArrowRight size={16} /></Link></div></div><span className="division-hero-icon"><Cable size={62} strokeWidth={1.2} /></span></div><div className="division-heading"><div><p className="eyebrow">Explore the range</p><h2>Reliable components for the work ahead.</h2></div><span>{categories.length ? `${categories.length} live categories` : "Categories are being prepared"}</span></div>{categories.length ? <div className="division-category-grid">{categories.map((category) => <Link className="division-category-card" href={`/categories/${category.slug}`} key={category.slug}>{category.imageUrl ? <div className="division-category-image" style={{ backgroundImage: `url(${category.imageUrl})` }} /> : <div className="division-category-image division-category-placeholder"><Cable size={28} /></div>}<div><h3>{category.name}</h3><p>{category.description}</p><small>{category.productCount ? `${category.productCount} live products` : "Explore available products"}<ArrowRight size={14} /></small></div></Link>)}</div> : <div className="empty-state"><h3>No live electrical categories yet.</h3><p>Use the product intake workflow to add approved electrical categories and products.</p></div>}</section></StorefrontShell>;
}
