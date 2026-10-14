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
  window.dispatchEvent(new CustomEvent<ReceiptEffectSale>("dantown-pos-sale-completed", { detail: sale }));
}
