import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Order, OrderInsert, OrderItemInsert } from "../types";

export type CreateOrderInput = { order: OrderInsert; items: OrderItemInsert[] };

export async function createOrder(client: SupabaseClient<Database>, input: CreateOrderInput) {
  const orderResult = await client.from("orders").insert(input.order).select().single<Order>();
  if (orderResult.error || !orderResult.data) return { order: orderResult.data, error: orderResult.error };
  const itemsResult = await client.from("order_items").insert(input.items.map((item) => ({ ...item, order_id: orderResult.data.id })));
  if (itemsResult.error) return { order: orderResult.data, error: itemsResult.error };
  return { order: orderResult.data, error: null };
}

export async function getCustomerOrders(client: SupabaseClient<Database>, customerId: string) {
  return client.from("orders").select("*").eq("customer_id", customerId).order("created_at", { ascending: false });
}
