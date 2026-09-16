import type { Metadata } from "next";
import { StorefrontShell } from "@/components/storefront";
import { AnimatedCartPageClient } from "@/components/cart/animated-cart-page-client";export const metadata : Metadata = {title: "Cart",description : "Review your selected Dantown electrical products before checkout."
};export default function CartPage() {return (<StorefrontShell><AnimatedCartPageClient /></StorefrontShell>);
}
