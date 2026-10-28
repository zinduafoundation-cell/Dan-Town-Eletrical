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

function wrapPdfLine(value: string, maxLength = 88) {
  const lines: string[] = [];
  let current = "";
  for (const token of value.split(/\s+/).filter(Boolean)) {
    let word = token;
    if (word.length > maxLength) {
      if (current) lines.push(current);
      while (word.length > maxLength) {
        lines.push(word.slice(0, maxLength));
        word = word.slice(maxLength);
      }
      current = word;
    } else if (!current) {
      current = word;
    } else if (current.length + word.length + 1 <= maxLength) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export function createReceiptPdf(sale: ReceiptEffectSale) {
  const headerLines = [
    "DANTOWN ELECTRICAL",
    "Receipt",
    `Order: ${sale.receiptNumber}`,
    `Date: ${new Date(sale.date).toLocaleString("en-KE")}`,
    `Payment: ${sale.paymentMethod}`,
    "",
    "Items",
  ];
  const itemLines = sale.items.flatMap((item) =>
    wrapPdfLine(`${item.qty} x ${item.name}${item.sku ? ` (${item.sku})` : ""}  ${amount(item.total, sale.currency)}`)
  );
  const footerLines = [
    "",
    `Subtotal: ${amount(sale.subtotal, sale.currency)}`,
    `Discount: ${amount(sale.discount, sale.currency)}`,
    `Tax: ${amount(sale.tax, sale.currency)}`,
    `Delivery: ${amount(sale.delivery, sale.currency)}`,
    `Total: ${amount(sale.total, sale.currency)}`
  ];
  const itemsPerPage = 19;
  const itemPages = itemLines.length
    ? Array.from({ length: Math.ceil(itemLines.length / itemsPerPage) }, (_, index) =>
      itemLines.slice(index * itemsPerPage, (index + 1) * itemsPerPage))
    : [[]];
  const pages = itemPages.map((pageItems, index) => [
    ...headerLines,
    ...pageItems,
    ...(index === itemPages.length - 1 ? footerLines : []),
  ].map(pdfText));
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  pages.forEach((lines, index) => {
    const pageObjectId = 4 + index * 2;
    const contentObjectId = pageObjectId + 1;
    const content = [
      "BT",
      ...lines.flatMap((line, lineIndex) => [
        `/F1 ${lineIndex < 2 ? 15 : 10} Tf`,
        `1 0 0 1 48 ${770 - lineIndex * 22} Tm`,
        `(${line}) Tj`
      ]),
      "ET"
    ].join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
    );
  });
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
