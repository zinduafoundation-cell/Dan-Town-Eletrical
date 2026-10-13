import { NextResponse } from "next/server";
import { businessDocumentSettingsSchema } from "@/lib/documents/business-document-settings";
import { requireAuthorizedPermission } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function PUT(request: Request) {
  try {
    const context = await requireAuthorizedPermission("settings.manage");
    const parsed = businessDocumentSettingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Review the document settings and try again." }, { status: 400 });
    }
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("business_document_settings").upsert({
      id: "dantown",
      template: parsed.data,
      updated_by: context.userId === "dev-bypass-user" ? null : context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return NextResponse.json({ settings: parsed.data });
  } catch (error) {
    console.error("Unable to save business document settings.", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save document settings." }, { status: 500 });
  }
}
