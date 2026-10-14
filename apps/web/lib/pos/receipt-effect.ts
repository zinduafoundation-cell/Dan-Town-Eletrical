export type ReceiptEffectSale = {
  receiptNumber: string;
  currency: string;
  items: Array<{ name: string; sku?: string | null; qty: number; total: number }>;
  subtotal: number;
  discount: number;
  tax: number;
  delivery: number;
  total: number;
  paymentMethod: string;
  date: string;
};

const pendingReceipts: ReceiptEffectSale[] = [];
const receiptEffectListeners = new Set<(sale: ReceiptEffectSale) => void>();

export function subscribePOSReceiptEffect(listener: (sale: ReceiptEffectSale) => void) {
  receiptEffectListeners.add(listener);
  pendingReceipts.splice(0).forEach((sale) => listener(sale));
  return () => receiptEffectListeners.delete(listener);
}

export function showPOSReceiptEffect(sale: ReceiptEffectSale) {
  if (typeof window === "undefined") return;
  if (
    !sale.receiptNumber ||
    !sale.currency ||
    !sale.paymentMethod ||
    !sale.date ||
    sale.items.length === 0 ||
    ![sale.subtotal, sale.discount, sale.tax, sale.delivery, sale.total].every(Number.isFinite) ||
    sale.items.some((item) => !item.name || !Number.isFinite(item.qty) || !Number.isFinite(item.total))
  ) {
    throw new Error("A complete, confirmed receipt is required to show the receipt effect.");
  }
  if (receiptEffectListeners.size === 0) {
    pendingReceipts.push(sale);
    return;
  }
  receiptEffectListeners.forEach((listener) => listener(sale));
}
