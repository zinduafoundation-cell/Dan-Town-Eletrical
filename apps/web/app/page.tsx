import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight, ShieldCheck, Boxes, Wrench, Sun } from "lucide-react";
import { buttonClassName } from "@dantown/ui";
import { ProductCard, StorefrontShell } from "@/components/storefront";
import { HeroCarousel } from "@/components/hero-carousel";
import { FeatureStrip } from "@/components/feature-strip";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCatalogProducts } from "@dantown/database";

const categories = [
  {
    name: "Solar",
    description: "Panels, batteries, inverters & backup",
    products: "120+ products",
    slug: "solar-renewable-energy",
    href: "/categories/solar-renewable-energy",
    image: "/images/categories/solar.jpg",
  },
  {
    name: "Electrical",
    description: "Cables, switches, sockets & protection",
    products: "250+ products",
    slug: "electrical-installation",
    href: "/categories/electrical-installation",
    image: "/images/categories/electrical.jpg",
  },
  {
    name: "Lighting",
    description: "LED, flood, indoor & outdoor lighting",
    products: "180+ products",
    slug: "lighting",
    href: "/categories/lighting",
    image: "/images/categories/lighting.jpg",
  },
  {
    name: "Tools",
    description: "Hand tools, power tools & equipment",
    products: "90+ products",
    slug: "tools-equipment",
    href: "/categories/tools-equipment",
    image: "/images/categories/tools.jpg",
  },
  {
    name: "Power & Backup",
    description: "Generators, batteries, UPS & backup",
    products: "70+ products",
    slug: "power-backup-energy-storage",
    href: "/categories/power-backup-energy-storage",
    image: "/images/categories/power-backup.jpg",
  },
  {
    name: "Kits",
    description: "Solar kits & complete electrical solutions",
    products: "45+ products",
    slug: "solar-renewable-energy",
    href: "/categories/solar-renewable-energy",
    image: "/images/categories/kits.jpg",
  },
  {
    name: "Accessories",
    description: "Connectors, fittings, cables & accessories",
    products: "110+ products",
    slug: "electrical-installation-materials",
    href: "/categories/electrical-installation-materials",
    image: "/images/categories/accessories.jpg",
  },
  {
    name: "Services",
    description: "Installation, repairs & maintenance",
    products: "8+ services",
    href: "/services",
    image: "/images/categories/services.jpg",
  },
];

const heroPromos = [
  {
    kicker: "Deals",
    title: "Weekend savings",
    description: "Smart price drops on essentials for the home and site.",
    href: "/deals",
    image: "/images/categories/electrical.jpg",
  },
  {
    kicker: "Gifts",
    title: "Gift ideas",
    description: "Practical picks for family, clients, and new beginnings.",
    href: "/categories/accessories",
    image: "/images/categories/accessories.jpg",
  },
  {
    kicker: "More",
    title: "Everything else",
    description: "Lighting, tools, kits, and service support in one place.",
    href: "/shop",
    image: "/images/categories/services.jpg",
  },
];

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const catalogProducts = await getCatalogProducts(supabase, {
    sort: "featured",
    allowFallback: true
  });
  const featuredProducts = catalogProducts.slice(0, 8);

  return (
    <StorefrontShell>

      <HeroCarousel products={featuredProducts} />
      <FeatureStrip />

      {/* =========================
          HERO
      ========================== */}
      {false && (<section className="dantown-hero" id="top">
        <div className="dantown-hero-copy">

          <p className="eyebrow">
            Kitale&apos;s electrical marketplace
          </p>

          <h1>
            Power your world.
            <br />
            <span>Build what&apos;s next.</span>
          </h1>

          <p className="hero-text">
            Electrical, solar and lighting products for homes,
            businesses and the professionals who keep Kenya moving.
          </p>

          <div className="hero-actions">

            <Link
              className={buttonClassName()}
              href="/shop"
            >
              Shop products
              <ArrowRight size={17} />
            </Link>

            <Link
              className="hero-outline-link"
              href="/solar-calculator"
            >
              Find your solar system
              <Sun size={16} />
            </Link>

          </div>

          <div className="hero-proof">
            <ShieldCheck size={18} />

            <span>
              Trusted supply and practical advice from Kitale
            </span>
          </div>

          <div className="hero-promo-grid" aria-label="Featured promotions">
            {heroPromos.map((promo) => (
              <Link key={promo.title} href={promo.href} className="hero-promo-card">
                <div className="hero-promo-image">
                  <Image
                    src={promo.image}
                    alt={promo.title}
                    fill
                    sizes="(max-width: 640px) 80vw, 25vw"
                    className="hero-promo-img"
                  />
                </div>

                <div className="hero-promo-copy">
                  <small>{promo.kicker}</small>
                  <strong>{promo.title}</strong>
                  <span>{promo.description}</span>
                </div>
              </Link>
            ))}
          </div>

        </div>


        {/* HERO VISUAL */}

        <div
          className="hero-showcase"
          aria-label="Solar power system"
        >

          <div
            className="hero-visual-art"
            aria-hidden="true"
          >

            <svg
              viewBox="0 0 720 520"
              role="presentation"
            >

              <defs>

                <linearGradient
                  id="hero-sky"
                  x1="0"
                  x2="1"
                  y1="0"
                  y2="1"
                >

                  <stop
                    offset="0"
                    stopColor="#011d38"
                  />

                  <stop
                    offset="1"
                    stopColor="#01162d"
                  />

                </linearGradient>

                <linearGradient
                  id="hero-ground"
                  x1="0"
                  x2="1"
                >

                  <stop
                    offset="0"
                    stopColor="#0b1c30"
                  />

                  <stop
                    offset="1"
                    stopColor="#0251B0"
                  />

                </linearGradient>

              </defs>


              <rect
                width="720"
                height="520"
                fill="url(#hero-sky)"
              />

              <circle
                cx="565"
                cy="105"
                r="62"
                fill="#D1FF42"
                opacity=".95"
              />

              <path
                d="M0 360 190 230l160 88 150-100 220 126v176H0Z"
                fill="url(#hero-ground)"
              />

              <path
                d="m70 372 240-120 188 91-244 123Z"
                fill="#071526"
                stroke="#D1FF42"
                strokeWidth="5"
              />

              <path
                d="m101 366 202-101 145 70-202 101Z"
                fill="#0e3761"
              />

              <path
                d="m151 339 10 5m41-30 10 5m41-30 10 5m41-30 10 5M126 378l10 5m41-30 10 5m41-30 10 5m41-30 10 5"
                stroke="#9bc4ef"
                strokeWidth="4"
              />

              <path
                d="M514 226v165m-58 0h116"
                stroke="#071526"
                strokeWidth="9"
              />

              <rect
                x="492"
                y="267"
                width="47"
                height="64"
                rx="5"
                fill="#D1FF42"
                stroke="#071526"
                strokeWidth="7"
              />

              <path
                d="m519 277-14 24h12l-8 18 18-25h-12Z"
                fill="#0251B0"
              />

              <path
                d="M0 425c120-26 210 30 333 0 110-27 225-22 387 12v83H0Z"
                fill="#071526"
                opacity=".86"
              />

            </svg>

          </div>


          <div className="hero-showcase-card">

            <Sun size={28} />

            <small>
              Own your energy
            </small>

            <strong>
              Explore solar.
            </strong>

            <Link href="/solar">
              Explore Solar
              <ChevronRight size={15} />
            </Link>

          </div>

        </div>

      </section>)}


      {/* ======================================
          SHOP BY CATEGORY — IMAGE MARKETPLACE
      ======================================= */}

      <section
        className="dantown-section dantown-category-section"
        id="shop"
      >

        <div className="dantown-section-heading">

          <div>

            <p className="eyebrow">
              Explore Dantown
            </p>

            <h2>
              Shop by Category
            </h2>

          </div>


          <Link
            className="text-link"
            href="/categories"
          >
            View all categories
            <ArrowRight size={16} />
          </Link>

        </div>


        {/* CATEGORY GRID */}

        <div className="dantown-category-grid">

          {categories.map((category) => (

            <Link
              key={category.name}
              href={category.href ?? `/categories/${category.slug}`}
              className="dantown-category-card"
            >

              {/* IMAGE */}

              <div className="dantown-category-image">

                <Image
                  src={category.image}
                  alt={category.name}
                  fill
                  sizes="
                    (max-width: 640px) 75vw,
                    (max-width: 1024px) 30vw,
                    16vw
                  "
                  className="dantown-category-img"
                />

                {/* IMAGE OVERLAY */}

                <div className="dantown-category-image-overlay" />

              </div>


              {/* CONTENT */}

              <div className="dantown-category-content">

                <div>

                  <h3>
                    {category.name}
                  </h3>

                  <p>
                    {category.description}
                  </p>

                  <small>
                    {category.products}
                  </small>

                </div>


                <span className="dantown-category-arrow">
                  <ChevronRight size={18} />
                </span>

              </div>

            </Link>

          ))}

        </div>

      </section>


      {/* =========================
          FEATURED PRODUCTS
      ========================== */}

      <section
        className="dantown-section product-section"
        id="featured"
      >

        <div className="dantown-section-heading">

          <div>

            <p className="eyebrow">
              Dantown featured
            </p>

            <h2>
              Built for the work ahead.
            </h2>

          </div>


          <Link
            className="text-link"
            href="/shop"
          >
            Shop everything
            <ArrowRight size={16} />
          </Link>

        </div>


        <div className="product-grid">

          {featuredProducts.map((product) => (

            <ProductCard
              product={product}
              key={product.id}
            />

          ))}

        </div>

      </section>


      {/* =========================
          COMPLETE SOLUTION
      ========================== */}

      <section className="dantown-feature-band">

        <div>

          <p className="eyebrow">
            Need a complete solution?
          </p>

          <h2>
            From a single socket to a full solar system.
          </h2>

        </div>


        <Link
          className={buttonClassName("secondary")}
          href="/request-quote"
        >
          Talk to an expert
          <ArrowRight size={17} />
        </Link>

      </section>


      {/* =========================
          TRUST
      ========================== */}

      <section className="dantown-trust">

        <span>
          <ShieldCheck size={20} />
          Genuine products
        </span>

        <span>
          <Boxes size={20} />
          Local stock coordination
        </span>

        <span>
          <Wrench size={20} />
          Advice that works
        </span>

      </section>

    </StorefrontShell>
  );
}