import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthorizedPermission } from "../../../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

const receiveSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  referenceId: z.string().uuid()
});

export async function POST(request: Request) {
  try {
    await requireAuthorizedPermission("inventory.adjust");
    const parsed = receiveSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Provide a purchase order, item, positive quantity, and unique reference." }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("receive_purchase_order_item", {
      target_purchase_order_id: parsed.data.purchaseOrderId,
      target_item_id: parsed.data.itemId,
      target_received_quantity: parsed.data.quantity,
      target_reference_id: parsed.data.referenceId
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("PURCHASE RECEIVE ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to receive purchase order." }, { status: 500 });
  }
}