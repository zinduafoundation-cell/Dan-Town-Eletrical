import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthorizedPermission } from "../../../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

const bulkSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1).max(500),
  action: z.enum(["publish", "unpublish", "enable-pos", "disable-pos", "archive", "category", "brand"]),
  value: z.string().uuid().nullable().optional()
});

export async function POST(request: Request) {
  try {
    const context = await requireAuthorizedPermission("products.update");
    const parsed = bulkSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Select products and a valid bulk action." }, { status: 400 });
    if (["category", "brand"].includes(parsed.data.action) && !parsed.data.value) return NextResponse.json({ error: "Choose a value for this bulk action." }, { status: 400 });

    const updates = parsed.data.action === "publish" ? { status: "ACTIVE", is_active: true } :
      parsed.data.action === "unpublish" ? { status: "DRAFT", is_active: false } :
      parsed.data.action === "enable-pos" ? { is_active: true } :
      parsed.data.action === "disable-pos" ? { is_active: false } :
      parsed.data.action === "archive" ? { status: "ARCHIVED", is_active: false } :
      parsed.data.action === "category" ? { category_id: parsed.data.value } : { brand_id: parsed.data.value };
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("products").update(updates).in("id", parsed.data.productIds).select("id");
    if (error) throw error;
    const actionName = parsed.data.action === "publish" ? "PRODUCT_PUBLISHED" : parsed.data.action === "unpublish" ? "PRODUCT_UNPUBLISHED" : parsed.data.action === "archive" ? "PRODUCT_ARCHIVED" : "PRODUCT_UPDATED";
    await supabase.from("audit_logs").insert(parsed.data.productIds.map((productId) => ({ user_id: context.userId === "dev-bypass-user" ? null : context.userId, action: actionName, resource_type: "product", resource_id: productId, new_data: { bulk_action: parsed.data.action, value: parsed.data.value ?? null } })));
    return NextResponse.json({ updated: data?.length ?? 0 });
  } catch (error) {
    console.error("CATALOG BULK UPDATE ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update products." }, { status: 500 });
  }
}
