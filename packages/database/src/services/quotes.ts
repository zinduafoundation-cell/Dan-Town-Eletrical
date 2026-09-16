import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

export async function getCustomerQuotes(client: SupabaseClient<Database>, customerId: string) {
  return client.from("quotations").select("*").eq("customer_id", customerId).order("created_at", { ascending: false });
}

export async function markQuoteConverted(client: SupabaseClient<Database>, quoteId: string, orderId: string) {
  return client.from("quotations").update({ status: "CONVERTED", converted_order_id: orderId }).eq("id", quoteId).select().single();
}
