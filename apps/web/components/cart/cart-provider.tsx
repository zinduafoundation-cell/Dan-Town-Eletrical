"use client";

import { ReactNode, useState, useEffect } from "react";
import { Cart, CartItem } from "./cart-types";
import { CartContext, CartContextType } from "./cart-context";

const STORAGE_KEY_PREFIX = "dantown-cart:";
const LEGACY_STORAGE_KEY = "dantown-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadUserCart() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const session = response.ok ? await response.json() : { userId: null };
        const key = `${STORAGE_KEY_PREFIX}${session.userId ?? "guest"}`;
        const stored = window.localStorage.getItem(key);
        const parsed = stored ? JSON.parse(stored) : [];
        if (!cancelled) {
          setItems(Array.isArray(parsed) ? parsed : []);
          setStorageKey(key);
          setIsHydrated(true);
        }
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch (error) {
        console.warn("Failed to load cart from storage:", error);
        if (!cancelled) {
          setStorageKey(`${STORAGE_KEY_PREFIX}guest`);
          setIsHydrated(true);
        }
      }
    }

    void loadUserCart();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (error) {
      console.warn("Failed to save cart to storage:", error);
    }
  }, [items, storageKey]);

  const cart: Cart = {
    items,
    getSubtotal: () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    getTotalCount: () => items.reduce((count, item) => count + item.quantity, 0),
    getTotal: () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    addItem: (item: CartItem) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.productId === item.productId);
        if (existing) {
          return prev.map((i) =>
            i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity } : i
          );
        }
        return [...prev, item];
      });
    },
    removeItem: (productId: string) => {
      setItems((prev) => prev.filter((item) => item.productId !== productId));
    },
    updateQuantity: (productId: string, quantity: number) => {
      setItems((prev) => {
        if (quantity <= 0) return prev.filter((item) => item.productId !== productId);
        return prev.map((item) => (item.productId === productId ? { ...item, quantity: Math.floor(quantity) } : item));
      });
    },
    clearCart: () => {
      setItems([]);
    }
  };

  const value: CartContextType = {
    ...cart,
    isHydrated
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
