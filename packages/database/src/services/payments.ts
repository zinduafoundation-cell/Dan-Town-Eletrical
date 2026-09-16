import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

export type PaymentRequest = { orderId: string; method: "MPESA" | "CASH" | "CARD" | "BANK_TRANSFER" | "PAY_ON_PICKUP" | "COD"; amount: number };

export async function createPendingPayment(client: SupabaseClient<Database>, input: PaymentRequest) {
  return client.from("payments").insert({ order_id: input.orderId, method: input.method, amount: input.amount, status: "PENDING" }).select().single();
}
