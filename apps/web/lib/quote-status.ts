export type QuoteStatusInput = {
  status: string | null;
  total: number | string | null;
  valid_until?: string | null;
};

export function buildQuoteStatusSummary(quote: QuoteStatusInput) {
  const normalizedStatus = (quote.status ?? "").trim();
  const label = getQuoteStatusLabel(normalizedStatus);
  const amount = formatAmount(quote.total);
  const validity = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }) : "No validity date yet";

  return {
    label,
    amount,
    validity,
    summary: `${label} • ${amount} • valid until ${validity}`
  };
}

function getQuoteStatusLabel(status: string) {
  if (!status) return "Pending review";
  const normalized = status.toUpperCase();
  if (normalized.includes("APPROV")) return "Approved";
  if (normalized.includes("DECLIN")) return "Declined";
  if (normalized.includes("EXPIRED")) return "Expired";
  if (normalized.includes("DRAFT")) return "Draft";
  if (normalized.includes("PENDING")) return "Pending review";
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAmount(value: number | string | null) {
  const numericValue = Number(value ?? 0);
  return `KSh ${Number.isFinite(numericValue) ? numericValue.toLocaleString("en-KE") : "0"}`;
}
