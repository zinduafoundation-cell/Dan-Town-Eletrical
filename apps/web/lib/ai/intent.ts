export type AiIntent = "products" | "categories" | "orders" | "quotes" | "documents" | "customers" | "suppliers" | "inventory" | "sales" | "payments" | "business" | "settings";

export function classifyQuestion(question: string): AiIntent {
  const text = question.toLowerCase();
  if (/(settings|configuration|configure|setting page)/.test(text)) return "settings";
  if (/\b(suppliers?|vendors?)\b/.test(text)) return "suppliers";
  if (/\bcustomers?\b/.test(text)) return "customers";
  if (/\b(invoices?|receipts?|delivery notes?|business documents?|document number|purchase orders?|supplier invoices?|credit notes?|debit notes?)\b|\boverdue\b|\bpast[- ]due\b/.test(text)) return "documents";
  if (/(quotation|quote)/.test(text)) return "quotes";
  if (/\borders?\b|\bdelivery\b|where is my/.test(text)) return "orders";
  if (/(refund policy|return policy|returns policy)/.test(text)) return "business";
  if (/(payment\s*(?:methods?|options?|types?|ways?)|what payments? do you accept|how can i pay|ways to pay)/.test(text)) return "business";
  if (/(cash session|cash drawer|payment|refund|reconcil|settlement|transaction)/.test(text)) return "payments";
  if (/(stock|available|availability|inventory|in stock|reorder|restock)/.test(text)) return "inventory";
  if (/(sales|revenue|selling|performance)/.test(text)) return "sales";
  if (/(category|categories)/.test(text)) return "categories";
  if (/(contact|location|opening|hours|pay|payment)/.test(text)) return "business";
  return "products";
}