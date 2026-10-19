import type { BusinessDocumentType } from "@dantown/database";

export function requestedDocumentTypes(question: string): BusinessDocumentType[] | null {
  const text = question.toLowerCase();
  if (/\bpro forma invoices?\b/.test(text)) return ["PROFORMA_INVOICE"];
  if (/\btax invoices?\b/.test(text)) return ["ETIMS_TAX_INVOICE", "VAT_RECORD"];
  if (/\binvoices?\b/.test(text)) return ["INVOICE", "SUPPLIER_INVOICE"];
  if (/\breceipts?\b/.test(text)) return ["RECEIPT"];
  if (/\bdelivery notes?\b/.test(text)) return ["DELIVERY_NOTE"];
  if (/\bdispatch notes?\b/.test(text)) return ["DISPATCH_NOTE"];
  if (/\bpurchase orders?\b/.test(text)) return ["PURCHASE_ORDER"];
  if (/\bgoods received notes?\b/.test(text)) return ["GOODS_RECEIVED_NOTE"];
  if (/\bcredit notes?\b/.test(text)) return ["CREDIT_NOTE"];
  if (/\bdebit notes?\b/.test(text)) return ["DEBIT_NOTE"];
  if (/\bcustomer statements?\b/.test(text)) return ["CUSTOMER_STATEMENT"];
  if (/\bsupplier statements?\b/.test(text)) return ["SUPPLIER_STATEMENT"];
  return null;
}

export function formatDateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) throw new Error("Unable to determine the business date.");
  return `${year}-${month}-${day}`;
}

export function extractEntitySearchTerm(question: string, entity: "customer" | "supplier") {
  const entityPattern = entity === "customer" ? /\bcustomers?\b/gi : /\b(?:suppliers?|vendors?)\b/gi;
  return question
    .replace(/\b(?:search|find|look up|show)\b/gi, " ")
    .replace(entityPattern, " ")
    .replace(/\b(?:in|for|named|called)\b/gi, " ")
    .replace(/[^\p{L}\p{N} .'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function extractQuoteNumber(question: string) {
  return question.match(/\b(?:quote|quotation)(?:\s+number)?\s+((?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{2,})\b/i)?.[1] ?? null;
}
