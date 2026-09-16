"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";

type AddToCartButtonProps = {
  productId: string;
  quantity?: number;
  className?: string;
};

export function AddToCartButton({
  productId,
  quantity = 1,
  className = ""
}: AddToCartButtonProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAddToCart() {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch("/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          productId,
          quantity
        })
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }

        throw new Error(
          result.error ?? "Unable to add product to cart."
        );
      }

      setMessage("Added!");

      router.refresh();

      setTimeout(() => {
        setMessage("");
      }, 2000);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      className={className}
      type="button"
      onClick={handleAddToCart}
      disabled={loading}
    >
      <ShoppingBag size={17} />

      {loading
        ? "Adding..."
        : message || "Add to cart"}
    </button>
  );
}