'use client';import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { StorefrontShell } from "@/components/storefront";
import { CheckoutPageClient } from "@/components/checkout/animated-checkout-page-client";export default function CheckoutPage() {return (<StorefrontShell><main className="page-shell"><motion.div  initial={{ opacity : 0, x: -10 }} animate={{ opacity : 1, x: 0 }} transition={{ duration : 0.3 }} ><Link href="/cart" className="back-link"><ArrowLeft size={18} />Back to cart </Link></motion.div><section className="checkout-layout"><motion.div  className="checkout-form-section"  initial={{ opacity : 0, y: 8 }} animate={{ opacity : 1, y: 0 }} transition={{ duration : 0.3, delay: 0.1 }} ><h1>Checkout</h1><CheckoutPageClient /></motion.div></section></main></StorefrontShell>);
}
