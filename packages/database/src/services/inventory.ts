import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, InventoryHealth, InventoryMovementType } from "../types";

export async function getInventoryHealth(client: SupabaseClient<Database>, warehouseId?: string) {
  let query = client.from("inventory_health").select("*");
  if (warehouseId) query = query.eq("warehouse_id", warehouseId);
  return query.returns<InventoryHealth[]>();
}

export async function adjustInventory(client: SupabaseClient<Database>, input: { productId: string; warehouseId: string; delta: number; movementType: InventoryMovementType; referenceType?: string; referenceId?: string }) {
  return client.rpc("adjust_inventory", {
    target_product_id: input.productId,
    target_warehouse_id: input.warehouseId,
    delta: input.delta,
    target_movement_type: input.movementType,
    target_reference_type: input.referenceType,
    target_reference_id: input.referenceId
  });
}
