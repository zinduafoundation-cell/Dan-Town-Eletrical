import "server-only";

import { z } from "zod";
export { pesapalPaymentMethod } from "./pesapal-utils";

const tokenResponseSchema = z.object({ token: z.string().min(1) });
const orderResponseSchema = z.object({
  order_tracking_id: z.string().min(1),
  merchant_reference: z.string().min(1),
  redirect_url: z.string().url(),
});
const statusResponseSchema = z.object({
  payment_status_code: z.union([z.number(), z.string()]),
  payment_status_description: z.string().optional(),
  payment_method: z.string().optional(),
  amount: z.union([z.number(), z.string()]),
  currency: z.string(),
  confirmation_code: z.string().optional(),
  description: z.string().optional(),
  message: z.string().optional(),
}).passthrough();

export type PesapalTransactionStatus = z.infer<typeof statusResponseSchema>;

export class PesapalApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "PesapalApiError";
  }
}

export function getPesapalConfig() {
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET?.trim();
  const ipnId = process.env.PESAPAL_IPN_ID?.trim();
  const environment = process.env.PESAPAL_ENVIRONMENT?.trim();
  const baseUrl = environment === "live"
    ? "https://pay.pesapal.com/v3"
    : environment === "sandbox"
      ? "https://cybqa.pesapal.com/pesapalv3"
      : null;

  return consumerKey && consumerSecret && ipnId && baseUrl
    ? { consumerKey, consumerSecret, ipnId, environment: environment as "sandbox" | "live", baseUrl }
    : null;
}

let cachedToken: { token: string; expiresAt: number; baseUrl: string } | null = null;

async function getAccessToken(config: NonNullable<ReturnType<typeof getPesapalConfig>>) {
  if (cachedToken && cachedToken.baseUrl === config.baseUrl && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const response = await fetch(`${config.baseUrl}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      consumer_key: config.consumerKey,
      consumer_secret: config.consumerSecret,
    }),
    cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => null);
  const parsed = tokenResponseSchema.safeParse(body);
  if (!response.ok || !parsed.success) {
    throw new PesapalApiError("Pesapal authentication failed.", response.status);
  }

  cachedToken = {
    token: parsed.data.token,
    baseUrl: config.baseUrl,
    expiresAt: Date.now() + 4 * 60_000,
  };
  return parsed.data.token;
}

async function authorizedRequest<T>(
  config: NonNullable<ReturnType<typeof getPesapalConfig>>,
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
) {
  const token = await getAccessToken(config);
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!response.ok || !parsed.success) {
    throw new PesapalApiError("Pesapal payment request failed.", response.status);
  }
  return parsed.data;
}

export async function submitPesapalOrder(input: {
  merchantReference: string;
  amount: number;
  description: string;
  email: string;
  phone?: string | null;
  callbackUrl: string;
}) {
  const config = getPesapalConfig();
  if (!config) throw new PesapalApiError("Pesapal is not configured.", 503);
  const result = await authorizedRequest(config, "/api/Transactions/SubmitOrderRequest", orderResponseSchema, {
    method: "POST",
    body: JSON.stringify({
      id: input.merchantReference,
      currency: "KES",
      amount: Number(input.amount.toFixed(2)),
      description: input.description,
      callback_url: input.callbackUrl,
      notification_id: config.ipnId,
      billing_address: {
        email_address: input.email,
        phone_number: input.phone ?? "",
        country_code: "KE",
      },
    }),
  });
  if (result.merchant_reference !== input.merchantReference) {
    throw new PesapalApiError("Pesapal returned a mismatched merchant reference.", 502);
  }
  return { ...result, environment: config.environment };
}

export async function getPesapalTransactionStatus(trackingId: string) {
  const config = getPesapalConfig();
  if (!config) throw new PesapalApiError("Pesapal is not configured.", 503);
  const result = await authorizedRequest(
    config,
    `/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(trackingId)}`,
    statusResponseSchema,
    { method: "GET" },
  );
  return { ...result, environment: config.environment };
}
