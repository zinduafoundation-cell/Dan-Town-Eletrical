"use client";

import { useState } from "react";
import { ArrowRightLeft, Lightbulb } from "lucide-react";
import { z } from "zod";

const adviceSchema = z.object({
  recommendations: z.array(z.object({
    product_id: z.string(),
    product_name: z.string().nullable(),
    quantity: z.number().int(),
    status: z.enum(["ready", "transfer_suggested", "insufficient_stock"]),
    available_quantity: z.number().int(),
    source_warehouse: z.object({ id: z.string(), name: z.string().nullable() }).nullable(),
    transfers: z.array(z.object({
      source_warehouse: z.object({ id: z.string(), name: z.string().nullable() }),
      destination_warehouse: z.object({ id: z.string(), name: z.string().nullable() }),
      quantity: z.number().int(),
    })),
    staff_confirmation_required: z.boolean(),
  })),
  stock_mutated: z.literal(false),
});

type Suggestion = {
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  quantity: number;
};

export function InventoryTransferAdvisor({
  productId,
  quantity,
  destinationWarehouseId,
  onUseSuggestion,
}: {
  productId: string;
  quantity: number;
  destinationWarehouseId: string;
  onUseSuggestion: (suggestion: Suggestion) => void;
}) {
  const [advice, setAdvice] = useState<z.infer<typeof adviceSchema> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestAdvice() {
    setAdvice(null);
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/inventory/transfer-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity, destinationWarehouseId }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const parsedError = z.object({ error: z.string() }).safeParse(result);
        throw new Error(parsedError.success ? parsedError.data.error : "Unable to get a transfer suggestion.");
      }
      const parsed = adviceSchema.safeParse(result);
      if (!parsed.success) throw new Error("The inventory advisor returned an invalid response.");
      setAdvice(parsed.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to get a transfer suggestion.");
    } finally {
      setLoading(false);
    }
  }

  const recommendation = advice?.recommendations[0];
  return (
    <div className="inventory-transfer-advisor">
      <button
        type="button"
        className="button button-secondary"
        onClick={requestAdvice}
        disabled={loading || !productId || !destinationWarehouseId || quantity < 1}
      >
        <Lightbulb size={15} />
        {loading ? "Checking stock..." : "Suggest source with Python"}
      </button>
      {error ? <p className="inventory-transfer-advisor-error" role="alert">{error}</p> : null}
      {recommendation?.status === "ready" && recommendation.source_warehouse ? (
        <p className="inventory-transfer-advisor-result" role="status">
          {recommendation.available_quantity} units are available at{" "}
          {recommendation.source_warehouse.name ?? recommendation.source_warehouse.id}. No transfer is suggested.
        </p>
      ) : null}
      {recommendation?.status === "transfer_suggested" ? (
        <div className="inventory-transfer-advisor-result" role="status">
          {recommendation.transfers.map((transfer, index) => (
            <div className="inventory-transfer-suggestion" key={`${transfer.source_warehouse.id}-${index}`}>
              <span>
                <ArrowRightLeft size={14} />
                Move {transfer.quantity} from {transfer.source_warehouse.name ?? transfer.source_warehouse.id}
                {" "}to {transfer.destination_warehouse.name ?? transfer.destination_warehouse.id}.
              </span>
              <button
                type="button"
                className="button button-quiet"
                onClick={() => onUseSuggestion({
                  sourceWarehouseId: transfer.source_warehouse.id,
                  destinationWarehouseId: transfer.destination_warehouse.id,
                  quantity: transfer.quantity,
                })}
              >
                Use suggestion
              </button>
            </div>
          ))}
          <small>Advice only: verify stock, move it physically, then confirm the transfer below.</small>
        </div>
      ) : null}
      {recommendation?.status === "insufficient_stock" ? (
        <p className="inventory-transfer-advisor-error" role="status">
          Only {recommendation.available_quantity} unreserved units are available across active warehouses.
        </p>
      ) : null}
    </div>
  );
}
