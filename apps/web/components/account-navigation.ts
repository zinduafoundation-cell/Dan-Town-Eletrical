export type AccountNavLink = {
  label: string;
  href: string;
};

export const defaultAccountLinks: AccountNavLink[] = [
  { label: "Overview", href: "/account" },
  { label: "My purchases", href: "/account/orders" },
  { label: "Quotes", href: "/account/quotes" },
  { label: "Wishlist", href: "/account/wishlist" },
  { label: "Support", href: "/account/support" }
];

export const storefrontPrimaryLinks: AccountNavLink[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Solar", href: "/solar" },
  { label: "Services", href: "/services" },
  { label: "Projects", href: "/projects" },
  { label: "Contact", href: "/contact" }
];

export function getSignedInAccountLinks(extraLinks: AccountNavLink[] = []): AccountNavLink[] {
  const seen = new Set<string>();
  return [...defaultAccountLinks, ...extraLinks].filter((link) => {
    if (seen.has(link.href)) {
      return false;
    }
    seen.add(link.href);
    return true;
  });
}
