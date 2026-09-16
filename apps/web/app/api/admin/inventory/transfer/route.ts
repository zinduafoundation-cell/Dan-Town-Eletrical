import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthorizedPermission } from "../../../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

const transferSchema = z.object({
  productId: z.string().uuid(),
  sourceWarehouseId: z.string().uuid(),
  destinationWarehouseId: z.string().uuid(),
  quantity: z.number().int().positive(),
  referenceId: z.string().uuid()
});

export async function POST(request: Request) {
  try {
    await requireAuthorizedPermission("inventory.adjust");
    const parsed = transferSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Provide two warehouses, a product, a positive quantity, and a unique reference." }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("transfer_inventory", {
      target_product_id: parsed.data.productId,
      target_source_warehouse_id: parsed.data.sourceWarehouseId,
      target_destination_warehouse_id: parsed.data.destinationWarehouseId,
      target_quantity: parsed.data.quantity,
      target_reference_id: parsed.data.referenceId
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("WAREHOUSE TRANSFER ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to transfer inventory." }, { status: 500 });
  }
}