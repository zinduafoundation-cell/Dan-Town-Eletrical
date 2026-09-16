export type LandedCostInput = {
  unitCost: number;
  allocatedTransport?: number;
  otherCosts?: number;
  supplierDiscount?: number;
  taxAmount?: number;
  taxIncluded?: boolean;
};

export function calculateLandedCost(input: LandedCostInput) {
  const base = input.unitCost + (input.allocatedTransport ?? 0) + (input.otherCosts ?? 0) - (input.supplierDiscount ?? 0);
  const tax = input.taxIncluded ? 0 : (input.taxAmount ?? 0);
  return Math.round(Math.max(0, base + tax) * 100) / 100;
}
