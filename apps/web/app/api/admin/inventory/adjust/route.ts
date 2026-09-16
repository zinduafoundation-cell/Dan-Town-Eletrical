import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthorizedPermission } from "../../../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

const adjustmentSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  delta: z.number().int().refine((value) => value !== 0, "Adjustment cannot be zero."),
  reason: z.string().trim().min(3).max(200)
});

export async function POST(request: Request) {
  try {
    const context = await requireAuthorizedPermission("inventory.adjust");
    const parsed = adjustmentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Provide a product, warehouse, non-zero quantity, and reason." }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("adjust_inventory", {
      target_product_id: parsed.data.productId,
      target_warehouse_id: parsed.data.warehouseId,
      delta: parsed.data.delta,
      target_movement_type: "ADJUSTMENT",
      target_reference_type: "admin_inventory_adjustment"
    });
    if (error) throw error;

    const { error: auditError } = await supabase.from("audit_logs").insert({
      user_id: context.userId === "dev-bypass-user" ? null : context.userId,
      action: parsed.data.delta > 0 ? "STOCK_ADDED" : "STOCK_REMOVED",
      resource_type: "inventory",
      resource_id: data?.id ?? null,
      new_data: { product_id: parsed.data.productId, warehouse_id: parsed.data.warehouseId, delta: parsed.data.delta, reason: parsed.data.reason }
    });
    if (auditError) console.error("INVENTORY AUDIT ERROR", auditError);

    return NextResponse.json({ data });
  } catch (error) {
    console.error("INVENTORY ADJUST ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to adjust inventory." }, { status: 500 });
  }
}
