import { describe, expect, it } from "vitest";
import { businessDocumentInputSchema } from "./business-document-input";

const validQuotation = {
  documentType: "QUOTATION",
  documentTitle: null,
  counterpartyType: "CUSTOMER",
  customerName: "Customer",
  customerContact: null,
  taxPin: null,
  issueDate: "2026-10-19",
  dueDate: null,
  paymentMethod: null,
  paymentTerms: null,
  relatedReference: null,
  relatedDocumentId: null,
  preparedBy: null,
  checkedBy: null,
  approvedBy: null,
  termsAndConditions: "",
  discount: 0,
  tax: 0,
  notes: "",
  lineItems: [{ name: "Cable", sku: null, quantity: 2, unitPrice: 100 }],
};

describe("business document input validation", () => {
  it("accepts a complete editable quotation draft", () => {
    expect(businessDocumentInputSchema.safeParse(validQuotation).success).toBe(true);
  });

  it("rejects invalid dates and missing required line items", () => {
    expect(businessDocumentInputSchema.safeParse({ ...validQuotation, issueDate: "2026-02-31" }).success).toBe(false);
    expect(businessDocumentInputSchema.safeParse({ ...validQuotation, lineItems: [] }).success).toBe(false);
  });

  it("requires source references for source-backed document types", () => {
    expect(businessDocumentInputSchema.safeParse({
      ...validQuotation,
      documentType: "SALES_ORDER",
      relatedReference: null,
    }).success).toBe(false);
  });
});
