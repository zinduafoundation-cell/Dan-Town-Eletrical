import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CircleUserRound,
  FileText,
  Heart,
  Package,
  Quote,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { getCatalogProducts } from "@dantown/database";
import { isBskEmailAddress, requireAuthenticated } from "../../lib/auth/server";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getDailyQuote } from "../../lib/daily-quote";
import { ProductCard, StorefrontShell } from "@/components/storefront";

export const dynamic = "force-dynamic";

const accountLinks = [
  { label: "Overview", href: "/account" },
  { label: "My Profile", href: "/account/profile" },
  { label: "My Purchases", href: "/account/orders" },
  { label: "Electrical Quotations", href: "/account/quotes" },
  { label: "My Projects", href: "/account/projects", status: "Coming soon" },
  { label: "Installation Tracking", href: "/account/installations", status: "Coming soon" },
  { label: "Saved Products", href: "/account/wishlist" },
  { label: "Delivery Addresses", href: "/account/addresses" },
  { label: "Payment Methods", href: "/account/payments" },
  { label: "Warranty & Documents", href: "/account/warranty", status: "Coming soon" },
  { label: "Help Centre", href: "/account/support" },
  { label: "Account Preferences", href: "/account/settings" }
];

export default async function AccountPage() {
  const context = await requireAuthenticated();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profileData }, { data: customerData }, { data: wishlist }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone, status")
        .eq("id", context.userId)
        .maybeSingle(),
      supabase
        .from("customers")
        .select("id, name, email, phone, customer_type, status")
        .eq("user_id", context.userId)
        .maybeSingle(),
      supabase
        .from("wishlists")
        .select("id")
        .eq("user_id", context.userId)
        .maybeSingle()
    ]);

  const customer = customerData ?? {
    id: "",
    name: "",
    email: null,
    phone: null,
    customer_type: null,
    status: null
  };
  const profile = profileData ?? { full_name: "", phone: null, status: null };
  const isBskOwner = isBskEmailAddress(customer.email ?? user?.email ?? null);

  const [{ count: orderCount }, { count: quoteCount }, { data: recentOrders }] =
    customer.id
      ? await Promise.all([
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("customer_id", customer.id),
          supabase
            .from("quotations")
            .select("id", { count: "exact", head: true })
            .eq("customer_id", customer.id),
          supabase
            .from("orders")
            .select("id, order_number, total, order_status, payment_status, created_at")
            .eq("customer_id", customer.id)
            .order("created_at", { ascending: false })
            .limit(3)
        ])
      : [{ count: 0 }, { count: 0 }, { data: [] }];

  const displayName = profile.full_name || customer.name || "Dantown customer";
  const firstName = displayName.split(" ")[0];
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const savedCount = wishlist
    ? (await supabase
        .from("wishlist_items")
        .select("product_id", { count: "exact", head: true })
        .eq("wishlist_id", wishlist.id)).count ?? 0
    : 0;
  const recommendations = await getCatalogProducts(supabase, {
    sort: "featured",
    page: 1,
    pageSize: 3,
    allowFallback: false
  });

  return (
    <StorefrontShell>
      <main className="account-hub page-shell">
        <div className="account-hub-heading">
          <div>
            <p className="eyebrow">Customer account</p>
            <h1>My Dantown Hub</h1>
            <p>Manage your purchases, electrical projects, quotations, and account preferences.</p>
          </div>
          <Link className="button button-secondary" href="/shop">Shop products <ArrowRight size={16} /></Link>
        </div>

        <div className="account-hub-layout">
          <aside className="account-hub-sidebar">
            <div className="account-hub-profile">
              <span className="account-avatar">{initials || "D"}</span>
              <strong>{displayName}</strong>
              <small>{customer.email || "Email not added yet"}</small>
              {isBskOwner && (
                <Link className="button button-primary" href="/business-center" style={{ marginTop: 12, width: "100%", justifyContent: "center" }}>
                  Open BSK
                </Link>
              )}
              <span className="account-verified"><ShieldCheck size={14} /> {profile.status || "Active customer"}</span>
            </div>
            <nav aria-label="Account navigation">
              {accountLinks.map((link) => (
                <Link className={link.href === "/account" ? "active" : undefined} href={link.href} key={link.href}>
                  <span>{link.label}</span>
                  {link.status && <small className="account-link-status">{link.status}</small>}
                </Link>
              ))}
              <Link href="/logout">Sign out</Link>
            </nav>
          </aside>

          <div className="account-hub-content">
            <section className="account-welcome-panel account-hub-welcome">
              <div>
                <p className="eyebrow">Welcome back, {firstName}.</p>
                <h2>Powering your next connection.</h2>
                <p>“{getDailyQuote()}”</p>
              </div>
              <Sparkles size={38} strokeWidth={1.4} />
            </section>

            <div className="account-hub-stats">
              <HubStat icon={Package} label="Total purchases" value={String(orderCount ?? 0)} href="/account/orders" />
              <HubStat icon={Bell} label="Active orders" value={String(recentOrders?.filter((order) => !["DELIVERED", "COMPLETED", "CANCELLED"].includes(order.order_status)).length ?? 0)} href="/account/orders" />
              <HubStat icon={Quote} label="Pending quotations" value={String(quoteCount ?? 0)} href="/account/quotes" />
              <HubStat icon={Heart} label="Saved products" value={String(savedCount)} href="/account/wishlist" />
            </div>

            <section className="content-panel account-hub-section">
              <div className="account-section-heading">
                <div><p className="eyebrow">Recent purchases</p><h2>Latest orders</h2></div>
                <Link className="text-link" href="/account/orders">View all <ArrowRight size={15} /></Link>
              </div>
              {recentOrders?.length ? (
                <div className="account-order-list">
                  {recentOrders.map((order) => (
                    <article className="account-order-row" key={order.id}>
                      <div><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleDateString("en-KE")}</small></div>
                      <div><strong>KSh {Number(order.total).toLocaleString("en-KE")}</strong><small>{order.order_status} · {order.payment_status}</small></div>
                    </article>
                  ))}
                </div>
              ) : <EmptyLink text="You have no purchases yet." href="/shop" label="Explore electrical products" />}
            </section>

            <div className="account-quick-actions">
              <QuickAction icon={FileText} title="Request a quotation" href="/request-quote" />
              <QuickAction icon={Heart} title="View saved products" href="/account/wishlist" />
              <QuickAction icon={CircleUserRound} title="Update your profile" href="/account/profile" />
              <QuickAction icon={ShieldCheck} title="Contact support" href="/account/support" />
            </div>

            <section className="account-hub-section">
              <div className="account-section-heading"><div><p className="eyebrow">Recommended for you</p><h2>Electrical essentials</h2></div><Link className="text-link" href="/shop">Browse all <ArrowRight size={15} /></Link></div>
              <div className="product-grid catalog-grid">{recommendations.map((product) => <ProductCard key={product.id} product={product} />)}</div>
            </section>
          </div>
        </div>
      </main>
    </StorefrontShell>
  );
}

function HubStat({ icon: Icon, label, value, href }: { icon: typeof Package; label: string; value: string; href: string }) {
  return <Link className="account-hub-stat" href={href}><span><Icon size={18} /></span><small>{label}</small><strong>{value}</strong><ArrowRight size={15} /></Link>;
}

function QuickAction({ icon: Icon, title, href }: { icon: typeof Package; title: string; href: string }) {
  return <Link className="account-quick-action" href={href}><Icon size={18} /><span>{title}</span><ArrowRight size={15} /></Link>;
}

function EmptyLink({ text, href, label }: { text: string; href: string; label: string }) {
  return <div className="account-empty"><p>{text}</p><Link className="text-link" href={href}>{label} <ArrowRight size={15} /></Link></div>;
}
