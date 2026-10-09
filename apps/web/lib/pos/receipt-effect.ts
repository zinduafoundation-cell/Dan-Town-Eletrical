export type ReceiptEffectSale = {
  receiptNumber: string;
  currency: string;
  items: Array<{ name: string; qty: number; price: number }>;
};

export function showPOSReceiptEffect(sale: ReceiptEffectSale) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ReceiptEffectSale>("dantown-pos-sale-completed", { detail: sale }));
}
