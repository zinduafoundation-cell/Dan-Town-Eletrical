export type PaystackMode = "test" | "live";

export function getPaystackMode(secretKey = process.env.PAYSTACK_SECRET_KEY?.trim()): PaystackMode | null {
  if (secretKey?.startsWith("sk_test_")) return "test";
  if (secretKey?.startsWith("sk_live_")) return "live";
  return null;
}
