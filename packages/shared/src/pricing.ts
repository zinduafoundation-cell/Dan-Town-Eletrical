export type PriceLine = { unitPrice: number; quantity: number; discount?: number; vatRate: number };
export type OrderTotals = { subtotal: number; discount: number; vat: number; total: number };

function money(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }

export function calculateOrderTotals(lines: PriceLine[], deliveryFee = 0): OrderTotals {
  const subtotal = money(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
  const discount = money(lines.reduce((sum, line) => sum + (line.discount ?? 0), 0));
  const taxable = Math.max(0, subtotal - discount);
  const vat = money(lines.reduce((sum, line) => sum + Math.max(0, line.unitPrice * line.quantity - (line.discount ?? 0)) * line.vatRate / 100, 0));
  return { subtotal, discount, vat, total: money(taxable + vat + deliveryFee) };
}

export function assertAvailableStock(quantity: number, reservedQuantity: number, requested: number) {
  if (requested <= 0 || requested > quantity - reservedQuantity) throw new Error("Requested quantity is not available.");
}
