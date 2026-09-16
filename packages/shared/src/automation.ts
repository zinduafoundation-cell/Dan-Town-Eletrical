export const automationWorkflows = [
  "01_supplier_message_ingestion", "02_email_invoice_ingestion", "03_document_extraction", "04_product_matching", "05_new_product_detection", "06_landed_cost_calculation", "07_ai_pricing", "08_pricing_validation", "09_inventory_receiving", "10_low_stock_alert", "11_product_publishing", "12_price_update", "13_platform_sync", "14_error_handling", "15_human_approval"
] as const;

export type AutomationWorkflow = (typeof automationWorkflows)[number];
export type NormalizedSupplierItem = { productName: string; sku?: string; barcode?: string; quantity: number; unit: string; unitCost: number; discount: number; tax: number };
export type NormalizedSupplierDocument = { supplier?: string; invoiceNumber?: string; invoiceDate?: string; currency: string; transport: number; items: NormalizedSupplierItem[] };
export type ProductMatchStatus = "MATCHED" | "POSSIBLE_MATCH" | "NEW_PRODUCT";
export type ProductMatchCandidate = { productId?: string; status: ProductMatchStatus; confidence: number; reasons: string[] };
export type PricingRecommendation = { retailPrice: number; contractorPrice: number; dealerPrice: number; wholesalePrice: number; promotionalPrice: number; minimumAllowedPrice: number; maximumSuggestedPrice: number; reasoningSummary: string; confidence: number; rulesPassed: boolean };
export type AutomationResult<T> = { ok: true; value: T } | { ok: false; status: "PROCESSING_FAILED" | "REQUIRES_REVIEW"; error: string; retryable: boolean };
