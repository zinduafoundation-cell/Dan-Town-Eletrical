import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Bolt, ChevronRight, ShieldCheck, SunMedium, Truck, Wrench, Zap } from "lucide-react";
import { ProductCard, StorefrontShell } from "@/components/storefront";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getHomepageCampaigns } from "@/lib/homepage-campaigns";
import { getCatalogCategories, getCatalogProducts } from "@dantown/database";

export const dynamic = "force-dynamic";

function categoryHeroImage(name: string) {
  if (/solar|battery|backup|power/i.test(name)) return "/images/categories/solar.jpg";
  if (/lighting|led|flood/i.test(name)) return "/images/categories/lighting.jpg";
  if (/tools|equipment|repair/i.test(name)) return "/images/categories/tools.jpg";
  if (/cable|switch|socket|electrical|conduit|panel/i.test(name)) return "/images/categories/electrical.jpg";
  return "/images/categories/accessories.jpg";
}

export default async function HomePage() {
  const supabase = createSupabaseServiceClient();
  const currentTimestamp = new Date().getTime();
  const bestSellerRequest = (async () => {
    try {
      return await supabase.rpc("get_storefront_best_sellers", { p_limit: 8 });
    } catch {
      return { data: [] };
    }
  })();
  const [catalogProducts, categoriesData, campaigns, newArrivals, flashSaleProducts, bestSellerResponse] = await Promise.all([
    getCatalogProducts(supabase, { sort: "featured", pageSize: 8, allowFallback: true }),
    getCatalogCategories(supabase),
    getHomepageCampaigns(supabase),
    getCatalogProducts(supabase, { sort: "newest", pageSize: 8, allowFallback: true }),
    getCatalogProducts(supabase, { activePromotionOnly: true, pageSize: 8, allowFallback: true }),
    bestSellerRequest,
  ]);

  const popularCategories = categoriesData
    .slice(0, 6)
    .map((category) => ({
      ...category,
      image: category.image_url ?? categoryHeroImage(category.name),
      href: `/categories/${category.slug}`,
      productCount: 0,
    }));

  const featuredProducts = catalogProducts.slice(0, 8);
  const homepageCampaign = campaigns[0] ?? null;
  const bestSellerIds = (bestSellerResponse.data ?? []).map((entry) => entry.product_id).filter(Boolean);
  const solarCategory = categoriesData.find((category) => /solar|battery|inverter|backup|power/i.test(`${category.name} ${category.slug}`)) ?? categoriesData[0];
  const [bestSellerProducts, solarProducts] = await Promise.all([
    bestSellerIds.length
      ? getCatalogProducts(supabase, { productIds: bestSellerIds, allowFallback: true })
      : Promise.resolve(featuredProducts.slice(0, 4)),
    solarCategory
      ? getCatalogProducts(supabase, { category: solarCategory.slug, pageSize: 6, allowFallback: true })
      : Promise.resolve(featuredProducts.slice(0, 4)),
  ]);

  const electricalProducts = catalogProducts.filter((product) => /cable|switch|socket|bulb|light|fuse|breaker|box|conduit|panel/i.test(`${product.name} ${product.category?.name ?? ""}`)).slice(0, 4);
  const serviceHighlights = [
    { title: "Site visits", copy: "On-site assessments for homes, offices, and commercial installations.", icon: Wrench },
    { title: "Solar design", copy: "System sizing, inverter matching, battery recommendations and installation planning.", icon: SunMedium },
    { title: "Power support", copy: "Repairs, maintenance and electrical upgrades for active property and business sites.", icon: Bolt },
  ];

  return (
    <StorefrontShell>
      <div className="dantown-marketplace-home">
        {homepageCampaign ? (
          <section className="dantown-home-hero">
            <div className="dantown-home-hero-copy">
              <p className="eyebrow">{homepageCampaign.badge}</p>
              <h1>{homepageCampaign.title}</h1>
              <p>{homepageCampaign.description}</p>
              <div className="dantown-home-hero-actions">
                <Link href={homepageCampaign.destination_url} className="button button-primary">
                  {homepageCampaign.cta_label} <ArrowRight size={15} />
                </Link>
                <Link href="/shop" className="text-link">Browse catalogue <ChevronRight size={15} /></Link>
              </div>
              <div className="dantown-home-hero-proof">
                <ShieldCheck size={16} />
                <span>Trusted electrical and solar supply in Kenya</span>
              </div>
            </div>

            <div className="dantown-home-hero-visual">
              <Image
                src={homepageCampaign.mobile_image_url || homepageCampaign.image_url || "/images/categories/electrical.jpg"}
                alt={homepageCampaign.title}
                fill
                sizes="(max-width: 900px) 100vw, 50vw"
                priority
                unoptimized
              />
            </div>
          </section>
        ) : null}

        <section className="dantown-section">
          <div className="dantown-section-heading">
            <div>
              <p className="eyebrow">Browse by need</p>
              <h2>Shop by category</h2>
            </div>
            <Link className="text-link" href="/categories">See all <ArrowRight size={15} /></Link>
          </div>

          <div className="dantown-category-grid">
            {popularCategories.map((category) => (
              <Link key={category.id} href={category.href} className="dantown-category-card">
                <div className="dantown-category-image">
                  <Image src={category.image} alt={category.name} fill sizes="(max-width: 700px) 80vw, 20vw" unoptimized />
                  <div className="dantown-category-image-overlay" />
                </div>
                <div className="dantown-category-content">
                  <div>
                    <h3>{category.name}</h3>
                    <p>{category.description || "Essential electrical and solar products"}</p>
                    <small>{category.productCount ? `${category.productCount} products` : "Popular picks"}</small>
                  </div>
                  <span className="dantown-category-arrow"><ChevronRight size={18} /></span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="dantown-section product-section">
          <div className="dantown-section-heading">
            <div>
              <p className="eyebrow">Fresh arrivals</p>
              <h2>New in the catalogue</h2>
            </div>
            <Link className="text-link" href="/shop">Shop everything <ArrowRight size={15} /></Link>
          </div>
          <div className="product-grid">
            {newArrivals.map((product) => <ProductCard product={product} key={product.id} currentTimestamp={currentTimestamp} />)}
          </div>
        </section>

        {flashSaleProducts.length > 0 ? (
          <section className="dantown-section product-section">
            <div className="dantown-section-heading">
              <div>
                <p className="eyebrow">Limited time</p>
                <h2>Flash sale</h2>
              </div>
              <Link className="text-link" href="/deals">View deals <ArrowRight size={15} /></Link>
            </div>
            <div className="product-grid">
              {flashSaleProducts.map((product) => <ProductCard product={product} key={product.id} currentTimestamp={currentTimestamp} />)}
            </div>
          </section>
        ) : null}

        <section className="dantown-section product-section">
          <div className="dantown-section-heading">
            <div>
              <p className="eyebrow">Top performers</p>
              <h2>Best sellers</h2>
            </div>
            <Link className="text-link" href="/shop">Explore more <ArrowRight size={15} /></Link>
          </div>
          <div className="product-grid">
            {bestSellerProducts.map((product) => <ProductCard product={product} key={product.id} currentTimestamp={currentTimestamp} />)}
          </div>
        </section>

        <section className="dantown-section product-section">
          <div className="dantown-section-heading">
            <div>
              <p className="eyebrow">Renewable energy</p>
              <h2>Solar deals</h2>
            </div>
            <Link className="text-link" href={solarCategory ? `/categories/${solarCategory.slug}` : "/solar"}>See all solar <ArrowRight size={15} /></Link>
          </div>
          <div className="product-grid">
            {solarProducts.map((product) => <ProductCard product={product} key={product.id} currentTimestamp={currentTimestamp} />)}
          </div>
        </section>

        <section className="dantown-section product-section">
          <div className="dantown-section-heading">
            <div>
              <p className="eyebrow">Household and site essentials</p>
              <h2>Electrical essentials</h2>
            </div>
            <Link className="text-link" href="/electrical">Browse electrical <ArrowRight size={15} /></Link>
          </div>
          <div className="product-grid">
            {electricalProducts.map((product) => <ProductCard product={product} key={product.id} currentTimestamp={currentTimestamp} />)}
          </div>
        </section>

        <section className="dantown-section dantown-services-section">
          <div className="dantown-section-heading">
            <div>
              <p className="eyebrow">Installation support</p>
              <h2>Services & projects</h2>
            </div>
            <Link className="text-link" href="/services">Book a service <ArrowRight size={15} /></Link>
          </div>

          <div className="dantown-service-grid">
            {serviceHighlights.map(({ title, copy, icon: Icon }) => (
              <div className="dantown-service-card" key={title}>
                <div className="dantown-service-icon"><Icon size={18} /></div>
                <strong>{title}</strong>
                <p>{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="dantown-section dantown-trust-section">
          <div className="dantown-section-heading">
            <div>
              <p className="eyebrow">Why customers return</p>
              <h2>Trusted delivery, support & service</h2>
            </div>
          </div>
          <div className="dantown-trust-grid">
            <div className="dantown-trust-card">
              <Truck size={18} />
              <strong>Fast delivery</strong>
              <p>Nationwide order support with reliable delivery updates and clear dispatch tracking.</p>
            </div>
            <div className="dantown-trust-card">
              <BadgeCheck size={18} />
              <strong>Secure payments</strong>
              <p>Multiple payment options with buyer protection and transparent order status checks.</p>
            </div>
            <div className="dantown-trust-card">
              <Zap size={18} />
              <strong>WhatsApp support</strong>
              <p>Talk to the team quickly for quotations, stock checks, and service planning.</p>
            </div>
          </div>
        </section>
      </div>
    </StorefrontShell>
  );
}