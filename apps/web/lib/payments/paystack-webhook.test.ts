import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPaystackWebhookSignature } from "./paystack-webhook";

describe("verifyPaystackWebhookSignature", () => {
  const secret = "sk_test_server_only";
  const body = "{\"event\":\"charge.success\",\"data\":{\"reference\":\"order-reference\"}}";
  const signature = createHmac("sha512", secret).update(body).digest("hex");

  it("accepts a matching HMAC signature over the raw body", () => {
    expect(verifyPaystackWebhookSignature(body, signature, secret)).toBe(true);
  });

  it("rejects missing secrets, missing signatures, and altered payloads", () => {
    expect(verifyPaystackWebhookSignature(body, signature, undefined)).toBe(false);
    expect(verifyPaystackWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyPaystackWebhookSignature(`${body} `, signature, secret)).toBe(false);
  });
});
