import { NextResponse } from "next/server";
import { loadBusinessConfiguration } from "@/lib/settings/business-configuration";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const configuration = await loadBusinessConfiguration();
    return NextResponse.json({ settings: configuration.documentSettings });
  } catch (error) {
    console.error("Unable to load business document settings.", error);
    return NextResponse.json({ error: "Business document settings are unavailable." }, { status: 503 });
  }
}
