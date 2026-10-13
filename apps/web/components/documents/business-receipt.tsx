import Image from "next/image";
import type { CSSProperties } from "react";
import type { BusinessDocumentSettings } from "@/lib/documents/business-document-settings";

export type BusinessReceiptLine = { name: string; sku?: string | null; quantity: number; total: number };

export function BusinessReceipt({
  settings,
  title = "Receipt",
  reference,
  date,
  customer,
  paymentMethod,
  lines,
  subtotal,
  discount,
  tax,
  delivery,
  total,
}: {
  settings: BusinessDocumentSettings;
  title?: string;
  reference: string;
  date: string;
  customer?: string | null;
  paymentMethod?: string | null;
  lines: BusinessReceiptLine[];
  subtotal?: number;
  discount?: number;
  tax?: number;
  delivery?: number;
  total: number;
}) {
  const currency = (amount: number) => `KSh ${amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <article className="business-receipt" style={{ "--document-accent": settings.accentColor } as CSSProperties}>
      <header className="business-receipt-header">
        {settings.logoUrl && <Image src={settings.logoUrl} alt="" width={72} height={72} unoptimized />}
        <h2>{settings.businessName}</h2>
        <p>{settings.address}</p>
        {settings.phone && <p>{settings.phone}</p>}
        {settings.email && <p>{settings.email}</p>}
      </header>
      <div className="business-receipt-title">
        <strong>{title}</strong>
        <span>{reference}</span>
        <span>{date}</span>
      </div>
      {settings.showCustomer && customer && <p className="business-receipt-customer">Customer: <strong>{customer}</strong></p>}
      <div className="business-receipt-lines">
        {lines.map((line, index) => (
          <div className="business-receipt-line" key={`${line.name}-${index}`}>
            <span>{line.quantity} × {line.name}{settings.showItemSkus && line.sku && <small>SKU {line.sku}</small>}</span>
            <strong>{currency(line.total)}</strong>
          </div>
        ))}
      </div>
      <div className="business-receipt-totals">
        {subtotal !== undefined && <p><span>Subtotal</span><strong>{currency(subtotal)}</strong></p>}
        {discount !== undefined && discount > 0 && <p><span>Discount</span><strong>-{currency(discount)}</strong></p>}
        {settings.showTax && tax !== undefined && <p><span>VAT / Tax</span><strong>{currency(tax)}</strong></p>}
        {delivery !== undefined && <p><span>Delivery</span><strong>{currency(delivery)}</strong></p>}
        {settings.showPaymentMethod && paymentMethod && <p><span>Payment</span><strong>{paymentMethod}</strong></p>}
        <p className="business-receipt-total"><span>Total</span><strong>{currency(total)}</strong></p>
      </div>
      <footer className="business-receipt-footer">{settings.footer}</footer>
    </article>
  );
}
