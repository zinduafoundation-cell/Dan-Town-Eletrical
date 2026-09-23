import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyPaystackWebhookSignature(
  rawBody: string,
  providedSignature: string | null,
  secret: string | undefined
): boolean {
  if (!secret) return false;
  if (!providedSignature) return false;

  const expectedSignature = createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

export function parsePaystackWebhookPayload(rawBody: string): Record<string, unknown> {
  return JSON.parse(rawBody) as Record<string, unknown>;
}
