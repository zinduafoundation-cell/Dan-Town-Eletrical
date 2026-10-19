import { NextResponse } from "next/server";
import { z } from "zod";
import { getPermissionGuard } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { businessDocumentInputSchema } from "@/lib/documents/business-document-input";
import { getBusinessDocumentType } from "@/lib/documents/business-document-types";
import { calculateBusinessDocumentAmounts } from "@/lib/documents/business-document-amounts";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const guard = await getPermissionGuard("settings.manage");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
    const { documentId } = await context.params;
    const parsedId = z.string().uuid().safeParse(documentId);
    if (!parsedId.success) return NextResponse.json({ error: "Choose a valid document." }, { status: 400 });

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

    const supabase = createSupabaseServiceClient();
    const { data: existing, error: existingError } = await supabase
      .from("business_documents")
      .select("document_type,document_status,issue_date,related_reference,related_document_id")
      .eq("id", parsedId.data)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return NextResponse.json({ error: "Business document not found." }, { status: 404 });
    if (existing.document_status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft documents can be edited." }, { status: 409 });
    }
    const type = getBusinessDocumentType(existing.document_type);
    if (!type || type.sourceOnly) {
      return NextResponse.json({ error: "Payment documents and unsupported types cannot be edited as standalone drafts." }, { status: 409 });
    }
    const document = parsed.data;
    if (
      document.documentType !== existing.document_type
      || document.issueDate !== existing.issue_date
      || document.relatedReference !== existing.related_reference
      || document.relatedDocumentId !== existing.related_document_id
    ) {
      return NextResponse.json({ error: "Document type, issue date, and source references cannot be changed after numbering." }, { status: 409 });
    }

    const amountResult = calculateBusinessDocumentAmounts(document.lineItems, document.discount, document.tax);
    if (amountResult.ok === false) return NextResponse.json({ error: amountResult.error }, { status: 400 });

    const { data, error } = await supabase.rpc("update_business_document_draft", {
      target_document_id: parsedId.data,
      document_data: {
        ...document,
        lineItems: document.lineItems.map(({ name, sku, quantity, unitPrice }) => ({ name, sku, quantity, unitPrice })),
      },
      actor_user_id: guard.context?.userId === "dev-bypass-user" ? null : guard.context?.userId ?? null,
    });
    if (error) {
      if (error.message.includes("not found")) return NextResponse.json({ error: error.message }, { status: 404 });
      if (error.message.includes("Only draft")) return NextResponse.json({ error: error.message }, { status: 409 });
      if (/Document (details|line items|amounts|total)/i.test(error.message)) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unable to edit business document draft:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Draft document could not be updated." }, { status: 500 });
  }
}
