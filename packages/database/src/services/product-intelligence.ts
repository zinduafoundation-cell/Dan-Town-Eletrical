import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LandedCostCalculationInsert, ProductMatchInsert, PricingRecommendationInsert } from "../types";

export function allocateSharedCosts(items: Array<{ unitCost: number; quantity: number }>, transportCost: number, otherCosts: number) {
  const totalPurchaseValue = items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);

  return items.map((item) => {
    const itemValue = item.unitCost * item.quantity;
    const fallbackShare = items.length > 0 ? (transportCost + otherCosts) / items.length : 0;
    const normalizedTransport = totalPurchaseValue > 0 ? (transportCost * itemValue) / totalPurchaseValue : transportCost / Math.max(items.length, 1);
    const normalizedOtherCosts = totalPurchaseValue > 0 ? (otherCosts * itemValue) / totalPurchaseValue : otherCosts / Math.max(items.length, 1);

    return {
      unitCost: item.unitCost,
      quantity: item.quantity,
      allocatedTransport: Number(Math.max(0, normalizedTransport).toFixed(2)),
      allocatedOtherCosts: Number(Math.max(0, normalizedOtherCosts).toFixed(2)),
      fallbackShare: Number(Math.max(0, fallbackShare).toFixed(2))
    };
  });
}

export function buildDeterministicPricingRecommendation(input: {
  landedCost: number;
  minimumMargin?: number;
  maximumDiscount?: number;
  vatRate?: number;
  roundingIncrement?: number;
  promotionalLimit?: number;
  stockLevel?: number;
}) {
  const minimumMargin = input.minimumMargin ?? 25;
  const maximumDiscount = input.maximumDiscount ?? 12;
  const vatRate = input.vatRate ?? 16;
  const roundingIncrement = input.roundingIncrement ?? 10;
  const promotionalLimit = input.promotionalLimit ?? 10;
  const stockLevel = input.stockLevel ?? 1;

  const roundTo = (value: number) => Math.ceil(value / roundingIncrement) * roundingIncrement;
  const minimumAllowedPrice = Math.max(0, roundTo(input.landedCost * (1 + minimumMargin / 100)));
  const retailPrice = Math.max(0, roundTo(input.landedCost * 1.35));
  const contractorPrice = Math.max(0, roundTo(input.landedCost * 1.25));
  const wholesalePrice = Math.max(0, roundTo(input.landedCost * 1.18));
  const dealerPrice = Math.max(0, roundTo(input.landedCost * 1.12));
  const discountRate = Math.min(maximumDiscount, promotionalLimit) / 100;
  const promotionalPrice = Math.max(0, roundTo(Math.max(minimumAllowedPrice, retailPrice * (1 - discountRate))));
  const maximumSuggestedPrice = Math.max(0, roundTo(Math.max(retailPrice, minimumAllowedPrice) * 1.2));
  const rulesPassed = minimumAllowedPrice >= input.landedCost && retailPrice >= contractorPrice && retailPrice >= dealerPrice && promotionalPrice >= minimumAllowedPrice && vatRate >= 0;

  return {
    retailPrice,
    contractorPrice,
    dealerPrice,
    wholesalePrice,
    promotionalPrice,
    minimumAllowedPrice,
    maximumSuggestedPrice,
    reasoningSummary: stockLevel <= 0 ? "Landed cost applied; stock level requires manual review before pricing approval." : "Deterministic margin rules applied with rounding and discount guardrails.",
    confidence: rulesPassed ? 0.88 : 0.42,
    rulesPassed,
    vatRate
  };
}

export async function createAutomationJob(client: SupabaseClient<Database>, input: { workflowName: string; source: string; sourceReference?: string | null; payload: unknown }) {
  return client.from("automation_jobs").insert({
    workflow_name: input.workflowName,
    source: input.source,
    source_reference: input.sourceReference ?? null,
    payload: input.payload as never
  }).select().single();
}

export async function saveProductMatch(client: SupabaseClient<Database>, match: ProductMatchInsert) {
  return client.from("product_matches").insert(match).select().single();
}

export async function saveLandedCost(client: SupabaseClient<Database>, calculation: LandedCostCalculationInsert) {
  return client.from("landed_cost_calculations").insert(calculation).select().single();
}

export async function savePricingRecommendation(client: SupabaseClient<Database>, recommendation: PricingRecommendationInsert) {
  return client.from("pricing_recommendations").insert(recommendation).select().single();
}

export async function publishPrice(client: SupabaseClient<Database>, input: { productId: string; priceType: string; oldPrice: number | null; newPrice: number; reason: string; source: "MANUAL" | "AI" | "SUPPLIER_UPDATE" | "PROMOTION" | "MARKET_UPDATE"; recommendationId?: string; approvedBy?: string }) {
  const history = await client.from("price_history").insert({ product_id: input.productId, price_type: input.priceType, old_price: input.oldPrice, new_price: input.newPrice, reason: input.reason, source: input.source, recommendation_id: input.recommendationId ?? null, approved_by: input.approvedBy ?? null }).select().single();
  return history;
}

export async function applyApprovedPricingRecommendation(client: SupabaseClient<Database>, input: { recommendationId: string; decision: "approve" | "reject"; reviewNote?: string | null; approvedBy: string }) {
  const { data: recommendation, error: recommendationError } = await client
    .from("pricing_recommendations")
    .select("*")
    .eq("id", input.recommendationId)
    .single();

  if (recommendationError || !recommendation) {
    throw new Error("Recommendation not found.");
  }

  const nextStatus = input.decision === "approve" ? "APPROVED" : "REJECTED";
  const { data: approval, error: approvalError } = await client
    .from("pricing_approvals")
    .insert({
      recommendation_id: input.recommendationId,
      status: nextStatus,
      submitted_by: null,
      reviewed_by: input.approvedBy,
      review_note: input.reviewNote ?? null,
      reviewed_at: new Date().toISOString()
    })
    .select()
    .single();

  if (approvalError || !approval) {
    throw new Error("Failed to record pricing approval.");
  }

  const { data: updatedRecommendation, error: updateRecommendationError } = await client
    .from("pricing_recommendations")
    .update({ status: nextStatus })
    .eq("id", input.recommendationId)
    .select()
    .single();

  if (updateRecommendationError || !updatedRecommendation) {
    throw new Error("Failed to update recommendation state.");
  }

  if (input.decision !== "approve") {
    return { recommendation: updatedRecommendation, approval };
  }

  const productId = recommendation.product_id;
  if (!productId) {
    return { recommendation: updatedRecommendation, approval };
  }

  const { data: product } = await client.from("products").select("*").eq("id", productId).single();
  const { data: landedCost } = await client
    .from("landed_cost_calculations")
    .select("*")
    .eq("id", recommendation.landed_cost_calculation_id ?? "")
    .maybeSingle();

  const warehouseQuery = await (client as any).from("warehouses").select("id").eq("is_active", true).order("created_at", { ascending: true }).limit(1).maybeSingle();
  const warehouseId = warehouseQuery.data?.id;

  if (!warehouseId) {
    throw new Error("No active warehouse is available for stock updates.");
  }

  const priceUpdates = {
    retail_price: recommendation.retail_price,
    contractor_price: recommendation.contractor_price,
    dealer_price: recommendation.dealer_price,
    wholesale_price: recommendation.wholesale_price,
    promotional_price: recommendation.promotional_price,
    cost_price: landedCost?.landed_cost ?? product?.cost_price ?? 0,
    updated_by: input.approvedBy
  };

  const { error: productError } = await client.from("products").update(priceUpdates).eq("id", productId);
  if (productError) {
    throw new Error("Failed to publish approved prices.");
  }

  if (product) {
    const historyRows: Array<Database["public"]["Tables"]["price_history"]["Insert"]> = [
      { product_id: productId, price_type: "retail_price", old_price: product.retail_price, new_price: recommendation.retail_price, reason: "Admin approved pricing recommendation", source: "AI", recommendation_id: input.recommendationId, approved_by: input.approvedBy },
      { product_id: productId, price_type: "contractor_price", old_price: product.contractor_price, new_price: recommendation.contractor_price, reason: "Admin approved pricing recommendation", source: "AI", recommendation_id: input.recommendationId, approved_by: input.approvedBy },
      { product_id: productId, price_type: "dealer_price", old_price: product.dealer_price, new_price: recommendation.dealer_price, reason: "Admin approved pricing recommendation", source: "AI", recommendation_id: input.recommendationId, approved_by: input.approvedBy },
      { product_id: productId, price_type: "wholesale_price", old_price: product.wholesale_price, new_price: recommendation.wholesale_price, reason: "Admin approved pricing recommendation", source: "AI", recommendation_id: input.recommendationId, approved_by: input.approvedBy },
      { product_id: productId, price_type: "promotional_price", old_price: product.promotional_price, new_price: recommendation.promotional_price, reason: "Admin approved pricing recommendation", source: "AI", recommendation_id: input.recommendationId, approved_by: input.approvedBy }
    ].filter((entry) => entry.old_price !== entry.new_price || entry.old_price !== null) as Array<Database["public"]["Tables"]["price_history"]["Insert"]>;

    if (historyRows.length) {
      const { error: historyError } = await client.from("price_history").insert(historyRows);
      if (historyError) {
        throw new Error("Failed to audit price publication.");
      }
    }
  }

  const landingInputs = (landedCost?.inputs ?? {}) as Record<string, unknown>;
  const quantityDelta = Number(landingInputs.quantity ?? 0);

  if (quantityDelta > 0) {
    const { data: existingInventory } = await client
      .from("inventory")
      .select("id, quantity")
      .eq("product_id", productId)
      .eq("warehouse_id", warehouseId)
      .limit(1)
      .maybeSingle();

    if (existingInventory) {
      const { error: inventoryError } = await client.rpc("adjust_inventory", {
        target_product_id: productId,
        target_warehouse_id: warehouseId,
        delta: quantityDelta,
        target_movement_type: "PURCHASE",
        target_reference_type: "pricing_approval",
        target_reference_id: approval.id
      });

      if (inventoryError) {
        throw new Error("Failed to update inventory after approval.");
      }
    } else {
      const { error: createInventoryError } = await client.from("inventory").insert({
        product_id: productId,
        warehouse_id: warehouseId,
        quantity: quantityDelta,
        reserved_quantity: 0,
        reorder_level: 0,
        reorder_quantity: 0
      });

      if (createInventoryError) {
        throw new Error("Failed to create inventory record after approval.");
      }
    }
  }

  return { recommendation: updatedRecommendation, approval };
}
