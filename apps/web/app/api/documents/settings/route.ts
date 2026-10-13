import { NextResponse } from "next/server";
import { businessDocumentSettingsSchema, defaultBusinessDocumentSettings } from "@/lib/documents/business-document-settings";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("business_document_settings")
    .select("template")
    .eq("id", "dantown")
    .maybeSingle();
  if (error) {
    console.error("Unable to load business document settings.", error);
    return NextResponse.json({ error: "Business document settings are unavailable." }, { status: 503 });
  }
  const parsed = businessDocumentSettingsSchema.safeParse(data?.template);
  if (data && !parsed.success) console.error("Stored business document settings are invalid.", parsed.error);
  return NextResponse.json({ settings: parsed.success ? parsed.data : defaultBusinessDocumentSettings });
}
