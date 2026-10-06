import Link from "next/link";
import { ArrowRight, Menu, ShoppingBag, ChevronDown, BriefcaseBusiness, CircleHelp, Lightbulb, Sun, Wrench, Zap } from "lucide-react";
import type { ReactNode } from "react";
import {
  categories,
  formatCurrency,
  getFeaturedProducts,
  getPopularProducts,
  type StoreProduct
} from "@/lib/store-data";
import { CartCountBadge } from "@/components/cart/cart-count-badge";
import { ProductCardActions } from "@/components/product-card-actions";
import { DanTAI } from "@/components/dan-t-ai";
import { AccountMenu } from "@/components/account-menu";
import type { CatalogProduct } from "@dantown/database";
import { SearchForm } from "@/components/search-form";
import { PublicGuidance } from "@/components/public-guidance";
import { WelcomeEntry } from "@/components/welcome-entry";
import { FloatingSupportHub } from "@/components/floating-support-hub";
import { defaultAccountLinks, storefrontPrimaryLinks } from "./account-navigation";

type StorefrontShellProps = {
  children: ReactNode;
  accountHref?: string;
  accountLabel?: string;
  accountLinks?: Array<{ label: string; href: string }>;
};

export function StorefrontShell({
  children,
  accountHref = "/account",
  accountLabel = "Account",
  accountLinks = defaultAccountLinks
}: StorefrontShellProps) {
  return (
    <main className="store-shell">
      <div className="utility-bar">
        <div className="utility-inner">
          <div className="utility-left">
            <span aria-hidden="true">📍</span>
            <span>Kitale, Kenya</span>
          </div>

          <nav className="utility-links" aria-label="Utility navigation">
            <Link href="/about">Delivery Information</Link>
            <Link href="/contact">Contact / Help</Link>
            <Link href="/account">{accountLabel}</Link>
          </nav>
        </div>
      </div>

      <header className="marketplace-header">
        <div className="marketplace-header-inner">
          <Link className="brand" href="/" aria-label="Dantown Electrical home">
            <span className="brand-mark">D</span>
            <span>
              DANTOWN <b>ELECTRICAL</b>
            </span>
          </Link>

          <div className="header-actions">
            <div className="marketplace-search-wrap">
              <SearchForm className="marketplace-search-form" />
            </div>
          </div>

          <div className="marketplace-actions">
            <AccountMenu accountLabel={accountLabel} accountLinks={accountLinks} />

            <Link href="/cart" className="icon-button cart-button" aria-label="Cart">
              <ShoppingBag size={18} />
              <CartCountBadge />
            </Link>
          </div>
        </div>
      </header>

      <nav className="marketplace-category-nav" aria-label="Marketplace categories">
        <div className="category-nav-inner">
          <details className="all-categories-menu">
            <summary><Menu size={16} /> Categories <ChevronDown size={14} /></summary>
            <div className="category-menu-panel">
              <div className="mega-menu-column">
                <strong>Electrical</strong>
                {categories
                  .filter((category) => ["lighting", "cables-wires", "switches-sockets", "circuit-protection", "distribution"].includes(category.slug))
                  .map((category) => <Link key={category.slug} href={`/categories/${category.slug}`}>{category.name}</Link>)}
                <Link href="/categories/tools-equipment">Tools &amp; equipment</Link>
              </div>
              <div className="mega-menu-column">
                <strong>Solar &amp; power</strong>
                <Link href="/solar">Solar solutions</Link>
                <Link href="/categories/solar-panels">Solar panels</Link>
                <Link href="/categories/solar-inverters">Inverters</Link>
                <Link href="/categories/solar-batteries">Batteries</Link>
                <Link href="/solar-calculator">Solar advisor</Link>
                <Link href="/ai/smart-match">Dantown AI Smart Match</Link>
              </div>
              <div className="mega-menu-column">
                <strong>Services</strong>
                <Link href="/services">Installation</Link>
                <Link href="/services">Maintenance &amp; repairs</Link>
                <Link href="/request-quote">Request a quote</Link>
              </div>
            </div>
          </details>

          <div className="category-links">
            {storefrontPrimaryLinks.map((link) => (
              <Link key={link.href} href={link.href}>{link.label}</Link>
            ))}
            <Link href="/ai/smart-match">Dantown AI Smart Match</Link>
            <Link href="/electrical">Electrical</Link>
            <Link href="/deals">Deals</Link>
            <Link href="/brands">Brands</Link>
            <details className="nav-more-menu">
              <summary>More <ChevronDown size={14} /></summary>
              <div className="nav-more-panel">
                <Link href="/services"><Wrench size={16} /> Services</Link>
                <Link href="/deals"><BriefcaseBusiness size={16} /> Deals</Link>
                <Link href="/brands"><Lightbulb size={16} /> Brands</Link>
                <Link href="/projects"><BriefcaseBusiness size={16} /> Projects</Link>
                <Link href="/solar"><Sun size={16} /> Solar</Link>
                <Link href="/electrical"><Zap size={16} /> Electrical</Link>
                <Link href="/contact"><CircleHelp size={16} /> Support</Link>
              </div>
            </details>
            <Link className="nav-quote-link" href="/request-quote">Request a quote</Link>
          </div>
        </div>
      </nav>

      <div className="mobile-menu-wrap">
        <details className="mobile-menu">
          <summary>
            <Menu size={18} />
            <span>Menu</span>
          </summary>
          <div className="mobile-menu-panel">
            <div className="mobile-menu-section">
              <p>Shopping</p>
              <Link href="/">Home</Link>
              <Link href="/shop">Shop</Link>
              <Link href="/solar">Solar</Link>
              <Link href="/electrical">Electrical</Link>
              <Link href="/brands">Brands</Link>
              <Link href="/solutions">Solutions</Link>
              <Link href="/services">Services</Link>
              <Link href="/solar-calculator">Solar Advisor</Link>
              <Link href="/ai/smart-match">Dantown AI Smart Match</Link>
              <Link href="/projects">Projects</Link>
              <Link href="/request-quote">Request Quote</Link>
              <Link href="/about">About</Link>
              <Link href="/business-center">Dantown Centre</Link>
              <Link href="/contact">Contact</Link>
            </div>

            <div className="mobile-menu-section">
              <p>Account</p>
              {defaultAccountLinks.map((link) => (
                <Link href={link.href} key={link.href}>{link.label}</Link>
              ))}
              <Link href="/logout">Sign out</Link>
            </div>
          </div>
        </details>
      </div>

      {children}

      <WelcomeEntry />
      <FloatingSupportHub />
      <DanTAI />
      <PublicGuidance showLauncher={false} />

      <footer className="store-footer">
        <div className="footer-brand">
          <Link className="brand" href="/">
            <span className="brand-mark">D</span>
            <span>
              DANTOWN <b>ELECTRICAL</b>
            </span>
          </Link>
          <p>Powering Kenya&apos;s next chapter.</p>
        </div>

        <div className="footer-links-group">
          <h3>Shop</h3>
          <Link href="/shop">Shop All</Link>
          <Link href="/brands">Brands</Link>
          <Link href="/deals">Deals</Link>
        </div>

        <div className="footer-links-group">
          <h3>Services</h3>
          <Link href="/services">Electrical &amp; solar services</Link>
          <Link href="/solutions">Solutions</Link>
          <Link href="/projects">Projects</Link>
          <Link href="/request-quote">Request Quote</Link>
        </div>

        <div className="footer-links-group">
          <h3>Customer</h3>
          <Link href="/account">Account</Link>
          <Link href="/contact">Help</Link>
          <Link href="/contact">Contact</Link>
        </div>

        <div className="footer-links-group">
          <h3>Company</h3>
          <Link href="/about">About Dantown</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </footer>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <Link href="/">
          <span>Home</span>
        </Link>
        <Link href="/shop">
          <span>Shop</span>
        </Link>
        <Link href="/search">
          <span>Search</span>
        </Link>
        <Link href="/cart">
          <span>Cart</span>
        </Link>
        <Link href={accountHref}>
          <span>Account</span>
        </Link>
      </nav>
    </main>
  );
}

export function SectionHeading({ kicker, title, link, linkText }: { kicker: string; title: string; link?: string; linkText?: string }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{kicker}</p>
        <h2>{title}</h2>
      </div>
      {link && (
        <Link className="text-link" href={link}>
          {linkText ?? "View all"} <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}

type ProductCardData = StoreProduct | CatalogProduct;

export function ProductCard({
  product
}: {
  product: ProductCardData;
}) {
  const isCatalogProduct = "retail_price" in product;

  const price = isCatalogProduct
    ? product.promotional_price ?? product.retail_price
    : product.price;

  const previousPrice = isCatalogProduct
    ? product.promotional_price ? product.retail_price : undefined
    : product.previousPrice;

  const categoryName = isCatalogProduct
    ? product.category?.name ?? "Electrical"
    : product.category;
  const brandName = isCatalogProduct
    ? product.brand?.name
    : product.brand;

  const categoryColor =
    categoryName === "Lighting"
      ? "#e8c56f"
      : categoryName === "Cables & Wires"
        ? "#b8ced3"
        : categoryName === "Circuit Protection"
          ? "#d87961"
          : "#d8e0c5";

  const stockStatus = isCatalogProduct
    ? "In stock"
    : product.stockStatus;

  return (
    <article className="store-product-card">
      <div
        className="product-art"
        style={{
          backgroundImage:
            isCatalogProduct && product.primary_image
              ? `url(${product.primary_image})`
              : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: categoryColor
        }}
      >
        {!isCatalogProduct && product.badge && (
          <span className="product-tag">{product.badge}</span>
        )}

        {isCatalogProduct && (product.promotion_label || product.featured) && (
          <span className="product-tag">{product.promotion_label ?? "Featured"}</span>
        )}

        {!(isCatalogProduct && product.primary_image) && (
          <div className="product-shape" />
        )}
      </div>

      <div className="product-info">
        <p>
          {brandName ? (
            isCatalogProduct && product.brand ? (
              <Link href={`/brands/${product.brand.slug}`}>{brandName}</Link>
            ) : (
              brandName
            )
          ) : null}
          {brandName ? " · " : ""}
          {categoryName}
        </p>

        <h3>
          <Link href={`/products/${product.slug}`}>
            {product.name}
          </Link>
        </h3>

        <div className="product-price-row">
          <strong>{formatCurrency(price)}</strong>

          {previousPrice && (
            <span>{formatCurrency(previousPrice)}</span>
          )}
        </div>

        <ProductCardActions
          product={{
            id: product.id,
            slug: product.slug,
            name: product.name,
            sku: product.sku,
            retail_price: price,
            primary_image: isCatalogProduct ? product.primary_image : null,
            featured: isCatalogProduct ? Boolean(product.featured) : false
          }}
          stockStatus={(stockStatus as "In stock" | "Low stock" | "Out of stock" | "Available on order")}
        />
      </div>
    </article>
  );
}

export function CategoryGrid() {
  return (
    <div className="category-grid">
      {categories.map((category) => (
        <Link className="category-card" href={`/categories/${category.slug}`} key={category.id} style={{ background: category.image }}>
          <span className="category-icon">↗</span>
          <span className="category-card-copy">
            <b>{category.name}</b>
            <small>{category.description}</small>
          </span>
        </Link>
      ))}
    </div>
  );
}

export function HomeFeaturedSection() {
  const featured = getFeaturedProducts();
  return (
    <section className="section product-section">
      <SectionHeading kicker="For the work ahead" title="Popular right now." link="/shop" linkText="Shop everything" />
      <div className="product-grid">
        {featured.map((product) => (
          <ProductCard product={product} key={product.id} />
        ))}
      </div>
    </section>
  );
}

export function PopularProductsSection() {
  const popular = getPopularProducts();
  return (
    <section className="section product-section compact">
      <SectionHeading kicker="Most trusted" title="Best sellers." link="/shop" linkText="Browse best sellers" />
      <div className="product-grid">
        {popular.map((product) => (
          <ProductCard product={product} key={product.id} />
        ))}
      </div>
    </section>
  );
}

export { SearchForm };
