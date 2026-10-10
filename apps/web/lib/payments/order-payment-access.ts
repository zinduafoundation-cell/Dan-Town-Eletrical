import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createOrderPaymentAccessToken() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    hash: createHash("sha256").update(token).digest("hex")
  };
}

export function verifyOrderPaymentAccessToken(token: string, storedHash: string | null) {
  if (!storedHash || !/^[a-f0-9]{64}$/i.test(storedHash)) return false;
  const suppliedHash = createHash("sha256").update(token).digest();
  const expectedHash = Buffer.from(storedHash, "hex");
  return suppliedHash.length === expectedHash.length && timingSafeEqual(suppliedHash, expectedHash);
}
