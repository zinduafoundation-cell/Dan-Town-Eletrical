export type CustomerProfileSummaryInput = {
  name: string | null;
  customer_type: string | null;
  email: string | null;
  phone: string | null;
  tax_number: string | null;
  notes: string | null;
  status: string | null;
};

export function buildCustomerProfileSummary(
  customer: CustomerProfileSummaryInput,
  counts: { addressCount?: number; orderCount?: number; quoteCount?: number }
) {
  const customerType = customer.customer_type ? customer.customer_type.toLowerCase().includes("business") ? "Business customer" : customer.customer_type.toLowerCase().includes("retail") ? "Retail customer" : customer.customer_type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Retail customer";
  const addressCount = counts.addressCount ?? 0;
  const orderCount = counts.orderCount ?? 0;
  const quoteCount = counts.quoteCount ?? 0;

  const purchaseCopy = orderCount === 0 ? "No purchases yet" : `${orderCount} purchase${orderCount === 1 ? "" : "s"}`;
  const addressCopy = addressCount === 0 ? "No saved delivery addresses" : `${addressCount} saved delivery address${addressCount === 1 ? "" : "es"}`;
  const quoteCopy = quoteCount === 0 ? "No active quotations" : `${quoteCount} quotation${quoteCount === 1 ? "" : "s"}`;

  return {
    taxLabel: customer.tax_number?.trim() ? customer.tax_number.trim() : "Tax registration not added",
    overview: `${customerType} • ${purchaseCopy} • ${addressCopy} • ${quoteCopy}`
  };
}
