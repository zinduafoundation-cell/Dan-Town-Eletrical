import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthorizedPermission } from "../../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

const purchaseSchema = z.object({ supplierId: z.string().uuid(), warehouseId: z.string().uuid(), productId: z.string().uuid(), quantity: z.number().int().positive(), unitCost: z.number().nonnegative(), tax: z.number().nonnegative().default(0), notes: z.string().trim().max(500).optional() });

export async function POST(request: Request) {
  try {
    const context = await requireAuthorizedPermission("inventory.adjust");
    const parsed = purchaseSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Check the supplier, warehouse, product, quantity, and cost." }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const subtotal = parsed.data.quantity * parsed.data.unitCost;
    const { data: order, error: orderError } = await supabase.from("purchase_orders").insert({ order_number: `PO-${Date.now()}`, supplier_id: parsed.data.supplierId, warehouse_id: parsed.data.warehouseId, status: "DRAFT", subtotal, tax: parsed.data.tax, total: subtotal + parsed.data.tax, expected_at: null, created_by: context.userId === "dev-bypass-user" ? null : context.userId, approved_by: null }).select("id,order_number").single();
    if (orderError || !order) throw orderError ?? new Error("Unable to create purchase order");
    const { error: itemError } = await supabase.from("purchase_order_items").insert({ purchase_order_id: order.id, product_id: parsed.data.productId, quantity: parsed.data.quantity, received_quantity: 0, unit_cost: parsed.data.unitCost });
    if (itemError) throw itemError;
    await supabase.from("audit_logs").insert({ user_id: context.userId === "dev-bypass-user" ? null : context.userId, action: "PURCHASE_CREATED", resource_type: "purchase_order", resource_id: order.id, new_data: { ...parsed.data, subtotal, total: subtotal + parsed.data.tax } });
    return NextResponse.json({ data: order });
  } catch (error) {
    console.error("PURCHASE CREATE ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create purchase order." }, { status: 500 });
  }
}
