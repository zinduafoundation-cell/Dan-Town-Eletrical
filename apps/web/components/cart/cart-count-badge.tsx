"use client";import { useCart } from "./cart-context";export function CartCountBadge() {const cart = useCart();const count = cart.getTotalCount();if (count === 0) {return <span className="bag-count"></span>;}return <span className="bag-count">{count}</span>;
}
