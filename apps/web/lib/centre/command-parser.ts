export type CentreCommandKind =
  | "attention"
  | "low-stock"
  | "unpaid-orders"
  | "pending-orders"
  | "recent-orders"
  | "sales"
  | "approval-required"
  | "help";

export type ParsedCentreCommand = {
  kind: CentreCommandKind;
  normalized: string;
};

export function parseCentreCommand(value: string): ParsedCentreCommand {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");

  if (/\b(create|send|change|delete|approve|adjust|transfer|refund)\b/.test(normalized)) {
    return { kind: "approval-required", normalized };
  }
  if (/\b(low stock|out of stock|stock risk|reorder|minimum stock|below minimum)\b/.test(normalized)) {
    return { kind: "low-stock", normalized };
  }
  if (/\b(unpaid|pending payment|payment pending|failed payment)\b/.test(normalized)) {
    return { kind: "unpaid-orders", normalized };
  }
  if (/\b(pending|stuck|waiting)\b/.test(normalized) && /\border/.test(normalized)) {
    return { kind: "pending-orders", normalized };
  }
  if (/\b(sales|revenue|turnover|performance)\b/.test(normalized)) {
    return { kind: "sales", normalized };
  }
  if (/\b(order|delivery)\b/.test(normalized)) {
    return { kind: "recent-orders", normalized };
  }
  if (/\b(attention|briefing|summary|today)\b/.test(normalized)) {
    return { kind: "attention", normalized };
  }
  return { kind: "help", normalized };
}
