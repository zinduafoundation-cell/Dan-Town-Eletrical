import { NextResponse } from "next/server";
import { z } from "zod";
import { getPermissionGuard } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { businessDocumentStatuses } from "@/lib/documents/business-document-types";

const statusSchema = z.object({
  status: z.enum(businessDocumentStatuses.map((status) => status.value) as [typeof businessDocumentStatuses[number]["value"], ...typeof businessDocumentStatuses[number]["value"][]]),
  note: z.string().trim().max(500).default(""),
});

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
    const parsed = statusSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Choose a valid status." }, { status: 400 });
    const { data, error } = await createSupabaseServiceClient().rpc("transition_business_document", {
      target_document_id: parsedId.data,
      target_status: parsed.data.status,
      transition_note: parsed.data.note,
      actor_user_id: guard.context?.userId === "dev-bypass-user" ? null : guard.context?.userId ?? null,
    });
    if (error) {
      const statusCode = error.message.includes("not found") ? 404 : 409;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unable to update business document status:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Document status could not be updated." }, { status: 500 });
  }
}
