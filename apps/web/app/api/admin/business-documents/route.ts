import { NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@dantown/database";
import { getPermissionGuard } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { businessDocumentGroups, businessDocumentStatuses, businessDocumentTypes, getBusinessDocumentSourceKind, getBusinessDocumentType, isBusinessDocumentType } from "@/lib/documents/business-document-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const documentFields =
  "id,document_number,document_type,document_group,document_title,document_status,counterparty_type,customer_name,customer_contact,issue_date,due_date,payment_method,payment_terms,currency,line_items,subtotal,discount,tax,total,notes,terms_and_conditions,tax_pin,related_reference,related_document_id,prepared_by,checked_by,approved_by,financial_year,created_by,updated_by,created_at";

const lineItemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().max(80).nullable().default(null),
  quantity: z.number().finite().positive().max(100000),
  unitPrice: z.number().finite().nonnegative().max(100000000),
});

const documentSchema = z.object({
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

export async function GET(request: Request) {
  try {
    const guard = await getPermissionGuard("settings.manage");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
    const params = new URL(request.url).searchParams;
    const eventsFor = params.get("eventsFor");
    const supabase = createSupabaseServiceClient();
    if (eventsFor) {
      const id = z.string().uuid().safeParse(eventsFor);
      if (!id.success) return NextResponse.json({ error: "Choose a valid document." }, { status: 400 });
      const { data, error } = await supabase.from("business_document_events")
        .select("id,business_document_id,event_type,previous_status,new_status,note,actor_id,created_at")
        .eq("business_document_id", id.data)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json({ data: data ?? [] });
    }

    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const pageSize = 50;
    const search = (params.get("q") ?? "").trim().replace(/[^a-z\d ._/-]/gi, "").slice(0, 80);
    const group = params.get("group");
    const type = params.get("type");
    const status = params.get("status");
    const yearText = params.get("year");
    const validGroup = businessDocumentGroups.find((entry) => entry.value === group)?.value;
    const validType = businessDocumentTypes.find((entry) => entry.value === type)?.value;
    const validStatus = businessDocumentStatuses.find((entry) => entry.value === status)?.value;
    if (group && !validGroup) return NextResponse.json({ error: "Choose a valid document section." }, { status: 400 });
    if (type && !validType) return NextResponse.json({ error: "Choose a valid document type." }, { status: 400 });
    if (status && !validStatus) return NextResponse.json({ error: "Choose a valid document status." }, { status: 400 });
    const year = yearText ? Number.parseInt(yearText, 10) : null;
    if (yearText && (!year || year < 2000 || year > 2200)) return NextResponse.json({ error: "Choose a valid financial year." }, { status: 400 });

    let query = supabase.from("business_documents").select(documentFields, { count: "exact" })
      .order("issue_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (search) query = query.or(`document_number.ilike.%${search}%,document_title.ilike.%${search}%,customer_name.ilike.%${search}%,related_reference.ilike.%${search}%`);
    if (validGroup) query = query.eq("document_group", validGroup);
    if (validType) query = query.eq("document_type", validType);
    if (validStatus) query = query.eq("document_status", validStatus);
    if (year) query = query.eq("financial_year", year);
    const { data, count, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data: data ?? [], pagination: { page, pageSize, total: count ?? 0 } });
  } catch (error) {
    console.error("Unable to load Centre business documents:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Documents could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const guard = await getPermissionGuard("settings.manage");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
    const parsed = documentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the document details." }, { status: 400 });
    }
    const document = parsed.data;
    const type = getBusinessDocumentType(document.documentType);
    if (!type) return NextResponse.json({ error: "Choose a valid document type." }, { status: 400 });
    if (type.sourceOnly) {
      return NextResponse.json({ error: "Payment documents must be created from a verified payment record, not entered as a standalone document." }, { status: 409 });
    }

    const supabase = createSupabaseServiceClient();
    const sourceKind = getBusinessDocumentSourceKind(type.value);
    if (sourceKind && document.relatedReference) {
      const sourceResult = sourceKind === "order"
        ? await supabase.from("orders").select("id").eq("order_number", document.relatedReference).maybeSingle()
        : await supabase.from("purchase_orders").select("id").eq("order_number", document.relatedReference).maybeSingle();
      if (sourceResult.error) throw sourceResult.error;
      if (!sourceResult.data) {
        return NextResponse.json({ error: `The referenced ${sourceKind === "order" ? "sales order" : "purchase order"} was not found. Search and select a real record.` }, { status: 400 });
      }
    }
    if (document.relatedDocumentId) {
      const { data: related, error: relatedError } = await supabase.from("business_documents")
        .select("id")
        .eq("id", document.relatedDocumentId)
        .maybeSingle();
      if (relatedError) throw relatedError;
      if (!related) return NextResponse.json({ error: "The related document could not be found." }, { status: 400 });
    }

    const lineItems: Database["public"]["Tables"]["business_documents"]["Insert"]["line_items"] = document.lineItems.map((item) => ({
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: Math.round(item.quantity * item.unitPrice * 100) / 100,
    }));
    const subtotal = Math.round(document.lineItems.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPrice * 100) / 100, 0) * 100) / 100;
    const discount = Math.round(document.discount * 100) / 100;
    const tax = Math.round(document.tax * 100) / 100;
    const total = Math.round((subtotal - discount + tax) * 100) / 100;
    if (subtotal > 9999999999.99 || discount > 9999999999.99 || tax > 9999999999.99) {
      return NextResponse.json({ error: "A document amount is above the supported limit." }, { status: 400 });
    }
    if (discount > subtotal) return NextResponse.json({ error: "Discount cannot exceed the line-item subtotal." }, { status: 400 });
    if (!Number.isFinite(total) || total > 999999999.99) return NextResponse.json({ error: "Document total is above the supported limit." }, { status: 400 });
    const insert: Database["public"]["Tables"]["business_documents"]["Insert"] = {
      document_type: type.value,
      document_group: type.group,
      document_title: document.documentTitle,
      document_status: "DRAFT",
      counterparty_type: document.counterpartyType,
      customer_name: document.customerName,
      customer_contact: document.customerContact,
      issue_date: document.issueDate,
      due_date: document.dueDate,
      payment_method: document.paymentMethod,
      payment_terms: document.paymentTerms,
      currency: "KES",
      line_items: lineItems,
      subtotal,
      discount,
      tax,
      total,
      notes: document.notes,
      terms_and_conditions: document.termsAndConditions,
      tax_pin: document.taxPin,
      related_reference: document.relatedReference,
      related_document_id: document.relatedDocumentId,
      prepared_by: document.preparedBy,
      checked_by: document.checkedBy,
      approved_by: document.approvedBy,
      created_by: guard.context?.userId === "dev-bypass-user" ? null : guard.context?.userId ?? null,
    };
    const { data, error } = await supabase.from("business_documents")
      .insert(insert)
      .select(documentFields)
      .single();
    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Unable to create Centre business document:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Document could not be saved." }, { status: 500 });
  }
}
