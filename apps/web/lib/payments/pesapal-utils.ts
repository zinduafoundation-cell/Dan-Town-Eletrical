export type PesapalPaymentMethod = "MPESA" | "CARD" | "BANK_TRANSFER";

export function pesapalPaymentMethod(method: string | undefined): PesapalPaymentMethod | null {
  const normalized = method?.toUpperCase().replace(/[^A-Z]/g, "") ?? "";
  if (normalized.includes("MPESA")) return "MPESA";
  if (["VISA", "MASTERCARD", "CARD", "AMEX", "AMERICANEXPRESS"].some((name) => normalized.includes(name))) {
    return "CARD";
  }
  if (normalized.includes("BANK") || normalized.includes("TRANSFER")) return "BANK_TRANSFER";
  return null;
}
