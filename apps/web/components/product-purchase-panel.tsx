"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { AddToCartButton } from "./add-to-cart-button";

type ProductPurchasePanelProps = {
  productId: string;
};

export function ProductPurchasePanel({
  productId
}: ProductPurchasePanelProps) {
  const [quantity, setQuantity] = useState(1);

  function decreaseQuantity() {
    setQuantity((current) => Math.max(1, current - 1));
  }

  function increaseQuantity() {
    setQuantity((current) => current + 1);
  }

  return (
    <div className="purchase-panel">
      <div className="quantity-selector">
        <button
          type="button"
          onClick={decreaseQuantity}
          aria-label="Decrease quantity"
        >
          <Minus size={17} />
        </button>

        <span>{quantity}</span>

        <button
          type="button"
          onClick={increaseQuantity}
          aria-label="Increase quantity"
        >
          <Plus size={17} />
        </button>
      </div>

      <AddToCartButton
        productId={productId}
        quantity={quantity}
        className="button button-primary product-add-button"
      />
    </div>
  );
}