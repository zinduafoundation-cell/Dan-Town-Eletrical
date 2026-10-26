import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const now = new Date().toISOString();
  const { data, error } = await createSupabaseServiceClient()
    .from("storefront_promotions")
    .select("id,title,description,badge,image_url,mobile_image_url,cta_label,show_on_homepage,destination_url,starts_at,ends_at")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) {
    console.error("Unable to load storefront promotions:", error.message);
    return NextResponse.json({ error: "Storefront promotions are temporarily unavailable." }, { status: 503 });
  }
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
}
