import type { ReceiptEffectSale } from "@/lib/pos/receipt-effect";

function pdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/([\\()])/g, "\\$1");
}

function amount(value: number, currency: string) {
  return `${currency} ${value.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function createReceiptPdf(sale: ReceiptEffectSale) {
  const lines = [
    "DANTOWN ELECTRICAL",
    "Receipt",
    `Order: ${sale.receiptNumber}`,
    `Date: ${new Date(sale.date).toLocaleString("en-KE")}`,
    `Payment: ${sale.paymentMethod}`,
    "",
    "Items",
    ...sale.items.map((item) => `${item.qty} x ${item.name}${item.sku ? ` (${item.sku})` : ""}  ${amount(item.total, sale.currency)}`),
    "",
    `Subtotal: ${amount(sale.subtotal, sale.currency)}`,
    `Discount: ${amount(sale.discount, sale.currency)}`,
    `Tax: ${amount(sale.tax, sale.currency)}`,
    `Delivery: ${amount(sale.delivery, sale.currency)}`,
    `Total: ${amount(sale.total, sale.currency)}`
  ].map(pdfText);
  const content = [
    "BT",
    ...lines.flatMap((line, index) => [
      `/F1 ${index < 2 ? 15 : 10} Tf`,
      `1 0 0 1 48 ${770 - index * 22} Tm`,
      `(${line}) Tj`
    ]),
    "ET"
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}
