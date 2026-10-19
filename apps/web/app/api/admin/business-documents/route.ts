import { NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@dantown/database";
import { getPermissionGuard } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { businessDocumentGroups, businessDocumentStatuses, businessDocumentTypes, getBusinessDocumentSourceKind, getBusinessDocumentType } from "@/lib/documents/business-document-types";
import { businessDocumentInputSchema } from "@/lib/documents/business-document-input";
import { calculateBusinessDocumentAmounts } from "@/lib/documents/business-document-amounts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const documentFields =
  "id,document_number,document_type,document_group,document_title,document_status,counterparty_type,customer_name,customer_contact,issue_date,due_date,payment_method,payment_terms,currency,line_items,subtotal,discount,tax,total,notes,terms_and_conditions,tax_pin,related_reference,related_document_id,prepared_by,checked_by,approved_by,financial_year,created_by,updated_by,created_at";

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
    let input: unknown;
    try {
      input = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json({ error: "Document details must be valid JSON." }, { status: 400 });
      }
      throw error;
    }
    const parsed = businessDocumentInputSchema.safeParse(input);
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

    const amountResult = calculateBusinessDocumentAmounts(document.lineItems, document.discount, document.tax);
    if (amountResult.ok === false) return NextResponse.json({ error: amountResult.error }, { status: 400 });
    const { lineTotals, subtotal, discount, tax, total } = amountResult.amounts;
    const lineItems: Database["public"]["Tables"]["business_documents"]["Insert"]["line_items"] = document.lineItems.map((item, index) => ({
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: lineTotals[index],
    }));
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
