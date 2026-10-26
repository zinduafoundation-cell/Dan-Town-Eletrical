import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BatteryCharging, Calculator, PanelsTopLeft, Sun, Wrench } from "lucide-react";
import { StorefrontShell } from "@/components/storefront";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getDivisionCategories, solarCategorySeeds } from "@/lib/division-data";

export const metadata: Metadata = {
  title: "Solar Division",
  description: "Explore Dantown Electrical solar products, estimate your energy needs, and request a system quote.",
};
export const dynamic = "force-dynamic";

export default async function SolarDivisionPage() {
  const categories = await getDivisionCategories(createSupabaseServiceClient(), solarCategorySeeds);
  return (
    <StorefrontShell>
      <section className="division-page division-solar">
        <section className="division-hero solar-division-hero" aria-labelledby="solar-division-title">
          <div>
            <p className="eyebrow">Dantown Electrical / Solar</p>
            <h1 id="solar-division-title">Plan your solar power with confidence.</h1>
            <p>Explore the solar products in our catalogue, estimate your energy needs, or ask the Dantown team to help plan your system.</p>
            <div className="hero-actions">
              <Link href="/solar-calculator" className="button button-primary"><Calculator size={17} /> Start the Solar Advisor</Link>
              <Link href="/request-quote" className="text-link">Request a system quote <ArrowRight size={16} /></Link>
            </div>
          </div>
          <span className="division-hero-icon" aria-hidden="true"><Sun size={62} strokeWidth={1.2} /></span>
        </section>

        <section className="solar-journey" aria-label="Ways to plan your solar project">
          <Link href="/solar-calculator" className="solar-journey-card">
            <span><Calculator size={20} /></span>
            <strong>Estimate your load</strong>
            <small>Start with the appliances and power you need.</small>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <a className="solar-journey-card" href="#solar-catalogue">
            <span><PanelsTopLeft size={20} /></span>
            <strong>Explore solar products</strong>
            <small>Browse live categories and available catalogue items.</small>
            <ArrowRight size={16} aria-hidden="true" />
          </a>
          <Link href="/request-quote" className="solar-journey-card">
            <span><Wrench size={20} /></span>
            <strong>Get project support</strong>
            <small>Share your requirements with the Dantown team.</small>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>

        <section id="solar-catalogue" className="solar-catalogue-section" aria-labelledby="solar-catalogue-title">
          <div className="division-heading">
            <div><p className="eyebrow">Explore the range</p><h2 id="solar-catalogue-title">Build your system, one component at a time.</h2></div>
            <span>{categories.length ? `${categories.length} live categories` : "No live categories yet"}</span>
          </div>
          {categories.length ? (
            <div className="division-category-grid">
              {categories.map((category) => (
                <Link className="division-category-card" href={`/categories/${category.slug}`} key={category.slug}>
                  {category.imageUrl
                    ? <div className="division-category-image" style={{ backgroundImage: `url(${category.imageUrl})` }} aria-hidden="true" />
                    : <div className="division-category-image division-category-placeholder" aria-hidden="true"><BatteryCharging size={28} /></div>}
                  <div>
                    <h3>{category.name}</h3>
                    <p>{category.description}</p>
                    <small>{category.productCount ? `${category.productCount} live products` : "View category"}<ArrowRight size={14} /></small>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="solar-catalogue-empty">
              <span><BatteryCharging size={24} /></span>
              <div><h3>Solar products are being added to the catalogue.</h3><p>You can still estimate your energy needs or send the team a project request.</p></div>
              <Link href="/solar-calculator" className="button button-primary">Open Solar Advisor <ArrowRight size={15} /></Link>
            </div>
          )}
        </section>
      </section>
    </StorefrontShell>
  );
}
