export const APP_NAME = "Dantown Electrical";
export const APP_LOCATION = "Kitale, Kenya";

export const userRoles = [
  "CEO",
  "ADMIN",
  "SALES_MANAGER",
  "STORE_MANAGER",
  "INVENTORY_MANAGER",
  "ACCOUNTANT",
  "PROCUREMENT",
  "SALES_AGENT",
  "CASHIER",
  "WAREHOUSE",
  "DELIVERY",
  "CUSTOMER",
  "CONTRACTOR"
] as const;

export type UserRole = (typeof userRoles)[number];
export const permissions = [
  "products.read", "products.create", "products.update", "products.delete",
  "promotions.read", "promotions.create", "promotions.update", "promotions.delete",
  "content.read", "content.update", "app.manage",
  "inventory.read", "inventory.adjust", "inventory.transfer",
  "orders.read", "orders.create", "orders.update", "orders.cancel",
  "customers.read", "customers.create", "customers.update",
  "quotes.read", "quotes.create", "quotes.update", "quotes.approve",
  "payments.read", "refunds.request", "refunds.approve",
  "reports.read", "finance.read", "users.read", "users.create", "users.update", "users.delete", "users.manage",
  "roles.read", "roles.manage", "settings.manage", "audit_logs.read",
  "automation.read", "automation.manage", "pricing.read", "pricing.manage", "pricing.approve"
] as const;

export type Permission = (typeof permissions)[number];
export const roleHierarchy: Record<UserRole, number> = {
  CEO: 100, ADMIN: 90, SALES_MANAGER: 70, STORE_MANAGER: 70, INVENTORY_MANAGER: 70,
  ACCOUNTANT: 60, PROCUREMENT: 60, SALES_AGENT: 40, CASHIER: 40, WAREHOUSE: 40,
  DELIVERY: 40, CUSTOMER: 0, CONTRACTOR: 0
};
export { assertAvailableStock, calculateOrderTotals } from "./pricing";
export type { OrderTotals, PriceLine } from "./pricing";
export { automationWorkflows } from "./automation";
export type { AutomationResult, AutomationWorkflow, NormalizedSupplierDocument, NormalizedSupplierItem, PricingRecommendation, ProductMatchCandidate, ProductMatchStatus } from "./automation";
export { matchProduct, normalizeProductName } from "./matching";
export type { MatchInput, MatchableProduct } from "./matching";
export { recommendPrices } from "./pricing-engine";
export type { PricingInput, PricingRuleInput } from "./pricing-engine";
export { calculateLandedCost } from "./landed-cost";
export type { LandedCostInput } from "./landed-cost";
