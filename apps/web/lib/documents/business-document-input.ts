import { z } from "zod";
import { getBusinessDocumentSourceKind, getBusinessDocumentType, isBusinessDocumentType } from "./business-document-types";

const lineItemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().max(80).nullable().default(null),
  quantity: z.number().finite().positive().max(100000),
  unitPrice: z.number().finite().nonnegative().max(100000000),
});

export const businessDocumentInputSchema = z.object({
  documentType: z.string().refine(isBusinessDocumentType, "Choose a document type."),
  documentTitle: z.string().trim().max(160).nullable().default(null),
  counterpartyType: z.enum(["CUSTOMER", "SUPPLIER", "INTERNAL"]),
  customerName: z.string().trim().max(160).nullable().default(null),
  customerContact: z.string().trim().max(120).nullable().default(null),
  taxPin: z.string().trim().max(24).nullable().default(null),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  paymentMethod: z.string().trim().max(48).nullable().default(null),
  paymentTerms: z.string().trim().max(240).nullable().default(null),
  relatedReference: z.string().trim().max(160).nullable().default(null),
  relatedDocumentId: z.string().uuid().nullable().default(null),
  preparedBy: z.string().trim().max(160).nullable().default(null),
  checkedBy: z.string().trim().max(160).nullable().default(null),
  approvedBy: z.string().trim().max(160).nullable().default(null),
  termsAndConditions: z.string().trim().max(3000).default(""),
  discount: z.number().finite().nonnegative().max(100000000).default(0),
  tax: z.number().finite().nonnegative().max(100000000).default(0),
  notes: z.string().trim().max(2000).default(""),
  lineItems: z.array(lineItemSchema).max(100).default([]),
}).superRefine((document, context) => {
  const type = getBusinessDocumentType(document.documentType);
  if (!type) return;
  if (type.requiresCounterparty && !document.customerName) {
    context.addIssue({ code: "custom", path: ["customerName"], message: "Enter the customer, supplier, or recipient name." });
  }
  if (type.sourceRecordRequired && !document.relatedReference && !document.relatedDocumentId) {
    context.addIssue({ code: "custom", path: ["relatedReference"], message: "This document must reference its actual source record." });
  }
  if (getBusinessDocumentSourceKind(type.value) && !document.relatedReference) {
    context.addIssue({ code: "custom", path: ["relatedReference"], message: "Search for and select an existing order or purchase order." });
  }
  if (type.value === "OTHER" && !document.documentTitle) {
    context.addIssue({ code: "custom", path: ["documentTitle"], message: "Enter a title for the other document." });
  }
  if (type.requiresLineItems && document.lineItems.length === 0) {
    context.addIssue({ code: "custom", path: ["lineItems"], message: "Add at least one line item for this document." });
  }
  if (document.customerName && document.counterpartyType === "INTERNAL") {
    context.addIssue({ code: "custom", path: ["counterpartyType"], message: "Choose customer or supplier when you enter an external party." });
  }
  const validIssueDate = new Date(`${document.issueDate}T00:00:00Z`);
  if (Number.isNaN(validIssueDate.getTime()) || validIssueDate.toISOString().slice(0, 10) !== document.issueDate) {
    context.addIssue({ code: "custom", path: ["issueDate"], message: "Enter a valid issue date." });
  }
  if (document.dueDate) {
    const validDueDate = new Date(`${document.dueDate}T00:00:00Z`);
    if (Number.isNaN(validDueDate.getTime()) || validDueDate.toISOString().slice(0, 10) !== document.dueDate) {
      context.addIssue({ code: "custom", path: ["dueDate"], message: "Enter a valid due date." });
    } else if (document.dueDate < document.issueDate) {
      context.addIssue({ code: "custom", path: ["dueDate"], message: "Due date must be on or after the issue date." });
    }
  }
});

export type BusinessDocumentInput = z.infer<typeof businessDocumentInputSchema>;
