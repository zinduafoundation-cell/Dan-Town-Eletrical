import "server-only";

import type { BusinessDocumentSettings } from "@/lib/documents/business-document-settings";
import { businessDocumentSettingsSchema, defaultBusinessDocumentSettings } from "@/lib/documents/business-document-settings";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function loadBusinessConfiguration(): Promise<{
  documentSettings: BusinessDocumentSettings;
  updatedAt: string | null;
  saved: boolean;
}> {
  const { data, error } = await createSupabaseServiceClient()
    .from("business_document_settings")
    .select("template,updated_at")
    .eq("id", "dantown")
    .maybeSingle();
  if (error) throw error;
  const parsed = businessDocumentSettingsSchema.safeParse(data?.template);
  if (data && !parsed.success) throw new Error("Saved business configuration is invalid.");
  return {
    documentSettings: parsed.success ? parsed.data : defaultBusinessDocumentSettings,
    updatedAt: data?.updated_at ?? null,
    saved: Boolean(data),
  };
}

export async function saveBusinessConfiguration(settings: BusinessDocumentSettings, updatedBy: string | null) {
  const { data, error } = await createSupabaseServiceClient().from("business_document_settings").upsert({
    id: "dantown",
    template: settings,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  }).select("updated_at").single();
  if (error) throw error;
  return data.updated_at;
}
