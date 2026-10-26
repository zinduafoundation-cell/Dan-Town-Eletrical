import { NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@dantown/database";
import { getPermissionGuard } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const promotionFields = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600).default(""),
  badge: z.string().trim().min(1).max(48).default("Special offer"),
  imageUrl: z.string().url().nullable().default(null),
  mobileImageUrl: z.string().url().nullable().default(null),
  ctaLabel: z.string().trim().min(1).max(48).default("Shop now"),
  showOnHomepage: z.boolean().default(false),
  destinationUrl: z.string().trim().max(500).default("/deals").refine(
    (value) => value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !/%2f|%5c/i.test(value),
    "Use a safe, site-relative destination."
  ),
  startsAt: z.string().datetime().nullable().default(null),
  endsAt: z.string().datetime().nullable().default(null),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).default(0),
}).superRefine((promotion, context) => {
  if (promotion.startsAt && promotion.endsAt && promotion.endsAt < promotion.startsAt) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "End date must be on or after the start date." });
  }
  if (promotion.showOnHomepage && !promotion.imageUrl) {
    context.addIssue({ code: "custom", path: ["imageUrl"], message: "Upload a desktop banner image before showing this campaign on the homepage." });
  }
});

const idSchema = z.string().uuid();
const storefrontRoutes = new Set([
  "/",
  "/about",
  "/account",
  "/brands",
  "/cart",
  "/categories",
  "/contact",
  "/deals",
  "/delivery",
  "/electrical",
  "/policies/delivery",
  "/policies/returns-refunds",
  "/request-quote",
  "/returns",
  "/search",
  "/services",
  "/shop",
  "/shop/deals",
  "/solar",
  "/solar-calculator",
  "/warranty",
]);

async function destinationExists(destinationUrl: string, supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const pathname = new URL(destinationUrl, "https://storefront.invalid").pathname;
  if (storefrontRoutes.has(pathname)) return true;
  const target = pathname.match(/^\/(products|categories|brands)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (!target) return false;
  const [, type, slug] = target;
  if (type === "products") {
    const { data, error } = await supabase.from("products").select("id").eq("slug", slug).eq("is_active", true).eq("status", "ACTIVE").maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }
  const table = type === "categories" ? "categories" : "brands";
  const { data, error } = await supabase.from(table).select("id").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function GET() {
  try {
    const guard = await getPermissionGuard("products.update");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("storefront_promotions")
      .select("id,title,description,badge,image_url,mobile_image_url,cta_label,show_on_homepage,destination_url,starts_at,ends_at,is_active,sort_order,created_at,updated_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    console.error("Unable to load promotion manager:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Promotions are unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const guard = await getPermissionGuard("products.update");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
    const context = guard.context!;
    const supabase = createSupabaseServiceClient();
    const parsed = promotionFields.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the promotion fields." }, { status: 400 });
    if (!await destinationExists(parsed.data.destinationUrl, supabase)) {
      return NextResponse.json({ error: "Choose a destination that exists on the storefront." }, { status: 400 });
    }
    const insert: Database["public"]["Tables"]["storefront_promotions"]["Insert"] = {
      title: parsed.data.title,
      description: parsed.data.description,
      badge: parsed.data.badge,
      image_url: parsed.data.imageUrl,
      mobile_image_url: parsed.data.mobileImageUrl,
      cta_label: parsed.data.ctaLabel,
      show_on_homepage: parsed.data.showOnHomepage,
      destination_url: parsed.data.destinationUrl,
      starts_at: parsed.data.startsAt,
      ends_at: parsed.data.endsAt,
      is_active: parsed.data.isActive,
      sort_order: parsed.data.sortOrder,
      created_by: context.userId === "dev-bypass-user" ? null : context.userId,
    };
    const { data, error } = await supabase.from("storefront_promotions").insert(insert).select().single();
    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Unable to create promotion:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Promotion could not be saved." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = await getPermissionGuard("products.update");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
    const supabase = createSupabaseServiceClient();
    const body = await request.json();
    const parsedId = idSchema.safeParse(body?.id);
    const parsedFields = promotionFields.safeParse(body);
    if (!parsedId.success || !parsedFields.success) {
      return NextResponse.json({ error: parsedFields.success ? "Choose a valid promotion." : parsedFields.error.issues[0]?.message ?? "Check the promotion fields." }, { status: 400 });
    }
    if (!await destinationExists(parsedFields.data.destinationUrl, supabase)) {
      return NextResponse.json({ error: "Choose a destination that exists on the storefront." }, { status: 400 });
    }
    const { data, error } = await supabase.from("storefront_promotions").update({
      title: parsedFields.data.title,
      description: parsedFields.data.description,
      badge: parsedFields.data.badge,
      image_url: parsedFields.data.imageUrl,
      mobile_image_url: parsedFields.data.mobileImageUrl,
      cta_label: parsedFields.data.ctaLabel,
      show_on_homepage: parsedFields.data.showOnHomepage,
      destination_url: parsedFields.data.destinationUrl,
      starts_at: parsedFields.data.startsAt,
      ends_at: parsedFields.data.endsAt,
      is_active: parsedFields.data.isActive,
      sort_order: parsedFields.data.sortOrder,
      updated_at: new Date().toISOString(),
    }).eq("id", parsedId.data).select().single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unable to update promotion:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Promotion could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const guard = await getPermissionGuard("products.update");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
    const supabase = createSupabaseServiceClient();
    const parsed = idSchema.safeParse(new URL(request.url).searchParams.get("id"));
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid promotion." }, { status: 400 });
    const { error } = await supabase.from("storefront_promotions").delete().eq("id", parsed.data);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to delete promotion:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Promotion could not be deleted." }, { status: 500 });
  }
}
