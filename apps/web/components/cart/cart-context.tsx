"use client";import { createContext, useContext } from "react";
import type { Cart } from "./cart-types";export type CartContextType = Cart & {isHydrated : boolean;
};export const CartContext = createContext<CartContextType | null>(null);export function useCart() : CartContextType {const context = useContext(CartContext);if (!context) {throw new Error("useCart must be used within CartProvider");}return context;
}export function useCartItem() {const { items } = useCart();return {count : items.length,items};
}
