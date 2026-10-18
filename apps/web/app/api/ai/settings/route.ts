import { NextResponse } from "next/server";
import { z } from "zod";
import { getPermissionGuard } from "@/lib/auth/server";
import { businessDocumentSettingsSchema } from "@/lib/documents/business-document-settings";
import { loadBusinessConfiguration, saveBusinessConfiguration } from "@/lib/settings/business-configuration";
import { aiEditableBusinessSettings } from "@/lib/ai/settings-change";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  field: z.enum(aiEditableBusinessSettings),
  value: z.string().trim().min(1).max(254),
});

export async function POST(request: Request) {
  try {
    const guard = await getPermissionGuard("settings.manage");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Choose a supported business profile setting and a valid value." }, { status: 400 });

    const { documentSettings } = await loadBusinessConfiguration();
    const candidate = { ...documentSettings, [parsed.data.field]: parsed.data.value };
    const validated = businessDocumentSettingsSchema.safeParse(candidate);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.issues[0]?.message ?? "The proposed setting value is invalid." }, { status: 400 });
    }
    const updatedAt = await saveBusinessConfiguration(
      validated.data,
      guard.context?.userId === "dev-bypass-user" ? null : guard.context?.userId ?? null,
    );
    return NextResponse.json({
      field: parsed.data.field,
      value: validated.data[parsed.data.field],
      updatedAt,
    });
  } catch (error) {
    console.error("Unable to update a business setting through DAN T AI:", error);
    return NextResponse.json({ error: "The business setting could not be updated." }, { status: 500 });
  }
}
