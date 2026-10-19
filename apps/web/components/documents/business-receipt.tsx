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
  customerContact,
  paymentMethod,
  paymentTerms,
  dueDate,
  notes,
  taxPin,
  relatedReference,
  preparedBy,
  checkedBy,
  approvedBy,
  termsAndConditions,
  showTotals = true,
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
  customerContact?: string | null;
  paymentMethod?: string | null;
  paymentTerms?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  taxPin?: string | null;
  relatedReference?: string | null;
  preparedBy?: string | null;
  checkedBy?: string | null;
  approvedBy?: string | null;
  termsAndConditions?: string | null;
  showTotals?: boolean;
  lines: BusinessReceiptLine[];
  subtotal?: number;
  discount?: number;
  tax?: number;
  delivery?: number;
  total: number;
}) {
  const currency = (amount: number) => `KSh ${amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <article className="business-receipt" data-paper-size={settings.paperSize} style={{ "--document-accent": settings.accentColor } as CSSProperties}>
      <header className="business-receipt-header">
        {settings.logoUrl && <Image src={settings.logoUrl} alt="" width={72} height={72} unoptimized />}
        <h2>{settings.businessName}</h2>
        {settings.branchName && <p>{settings.branchName}</p>}
        <p>{settings.address}</p>
        {settings.country !== "Kenya" && <p>{settings.country}</p>}
        {settings.phone && <p>{settings.phone}</p>}
        {settings.email && <p>{settings.email}</p>}
        {settings.registrationNumber && <p>Registration No: {settings.registrationNumber}</p>}
        {settings.kraPin && <p>KRA PIN: {settings.kraPin}</p>}
        {taxPin && <p>Customer / supplier PIN: {taxPin}</p>}
      </header>
      <div className="business-receipt-title">
        <strong>{title}</strong>
        <span>{reference}</span>
        <span>{date}</span>
        {relatedReference && <span>Related reference: {relatedReference}</span>}
      </div>
      {settings.showCustomer && (customer || customerContact) && <p className="business-receipt-customer">Customer: <strong>{customer}</strong>{customerContact && <><br />Contact: {customerContact}</>}</p>}
      {(dueDate || paymentTerms) && <div className="business-receipt-document-terms">
        {dueDate && <p><span>Due date</span><strong>{dueDate}</strong></p>}
        {paymentTerms && <p><span>Payment terms</span><strong>{paymentTerms}</strong></p>}
      </div>}
      <div className="business-receipt-lines">
        {lines.map((line, index) => (
          <div className="business-receipt-line" key={`${line.name}-${index}`}>
            <span>{line.quantity} × {line.name}{settings.showItemSkus && line.sku && <small>SKU {line.sku}</small>}</span>
            <strong>{currency(line.total)}</strong>
          </div>
        ))}
      </div>
      {showTotals && <div className="business-receipt-totals">
        {subtotal !== undefined && <p><span>Subtotal</span><strong>{currency(subtotal)}</strong></p>}
        {discount !== undefined && discount > 0 && <p><span>Discount</span><strong>-{currency(discount)}</strong></p>}
        {settings.showTax && tax !== undefined && <p><span>VAT / Tax</span><strong>{currency(tax)}</strong></p>}
        {delivery !== undefined && <p><span>Delivery</span><strong>{currency(delivery)}</strong></p>}
        {settings.showPaymentMethod && paymentMethod && <p><span>Payment</span><strong>{paymentMethod}</strong></p>}
        <p className="business-receipt-total"><span>Total</span><strong>{currency(total)}</strong></p>
      </div>}
      {notes && <p className="business-receipt-notes"><strong>Notes:</strong> {notes}</p>}
      {termsAndConditions && <p className="business-receipt-notes"><strong>Terms and conditions:</strong> {termsAndConditions}</p>}
      {(preparedBy || checkedBy || approvedBy) && <div className="business-document-signatures">
        {preparedBy && <p><span>Prepared by</span><strong>{preparedBy}</strong></p>}
        {checkedBy && <p><span>Checked by</span><strong>{checkedBy}</strong></p>}
        {approvedBy && <p><span>Approved by</span><strong>{approvedBy}</strong></p>}
      </div>}
      <footer className="business-receipt-footer">{settings.footer}</footer>
    </article>
  );
}
