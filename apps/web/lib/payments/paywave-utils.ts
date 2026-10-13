export function normalizeKenyanPhone(input: string) {
  const digits = input.replace(/\D/g, "");
  const normalized = digits.startsWith("0")
    ? `254${digits.slice(1)}`
    : digits.length === 9 && /^[17]/.test(digits)
      ? `254${digits}`
      : digits;

  if (!/^254[17]\d{8}$/.test(normalized)) {
    throw new Error("Enter a valid Kenyan M-Pesa mobile number.");
  }
  return normalized;
}

export function toKshAmount(amount: number) {
  if (!Number.isFinite(amount) || amount < 1) {
    throw new Error("Paywave Express payments must be at least KSh 1.");
  }
  return amount.toFixed(2);
}

export function matchesKshAmount(actual: string | number, expected: number) {
  const amount = Number(actual);
  return Number.isFinite(amount) && Math.round(amount * 100) === Math.round(expected * 100);
}
