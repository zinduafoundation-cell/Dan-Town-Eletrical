import type { PricingRecommendation } from "./automation";

export type PricingRuleInput = { minimumMargin: number; maximumDiscount: number; vatRate: number; roundingIncrement: number; promotionalLimit: number };
export type PricingInput = { landedCost: number; currentRetailPrice?: number; stockLevel: number; segment: "RETAIL" | "CONTRACTOR" | "WHOLESALE" | "DEALER" | "CORPORATE"; rule: PricingRuleInput };

const roundTo = (value: number, increment: number) => Math.ceil(value / increment) * increment;

export function recommendPrices(input: PricingInput): PricingRecommendation {
  const { landedCost, rule, segment, stockLevel } = input;
  const minimumAllowedPrice = roundTo(landedCost * (1 + rule.minimumMargin / 100), rule.roundingIncrement);
  const retailPrice = roundTo(landedCost * 1.35, rule.roundingIncrement);
  const contractorPrice = roundTo(landedCost * 1.25, rule.roundingIncrement);
  const wholesalePrice = roundTo(landedCost * 1.18, rule.roundingIncrement);
  const dealerPrice = roundTo(landedCost * 1.12, rule.roundingIncrement);
  const promotionalPrice = roundTo(retailPrice * (1 - Math.min(rule.promotionalLimit, rule.maximumDiscount) / 100), rule.roundingIncrement);
  const segmentPrice = segment === "RETAIL" ? retailPrice : segment === "CONTRACTOR" ? contractorPrice : segment === "WHOLESALE" ? wholesalePrice : dealerPrice;
  const rulesPassed = segmentPrice >= minimumAllowedPrice && promotionalPrice >= minimumAllowedPrice;
  return { retailPrice, contractorPrice, dealerPrice, wholesalePrice, promotionalPrice, minimumAllowedPrice, maximumSuggestedPrice: roundTo(retailPrice * 1.2, rule.roundingIncrement), reasoningSummary: stockLevel <= 0 ? "Base margin applied; stock level requires review." : "Base margin and configured rounding applied.", confidence: rulesPassed ? 0.88 : 0.42, rulesPassed };
}
