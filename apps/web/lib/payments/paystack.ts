import { z } from "zod";

const PAYSTACK_API_URL = "https://api.paystack.co";

const envelopeSchema = z.object({
  status: z.boolean(),
  message: z.string().optional(),
  data: z.unknown()
});

const initializeResponseSchema = z.object({
  authorization_url: z.string().url(),
  access_code: z.string().min(1),
  reference: z.string().min(1)
});

const verifyResponseSchema = z.object({
  amount: z.number().int().nonnegative(),
  status: z.string(),
  reference: z.string().min(1),
  currency: z.string().optional(),
  customer: z.json().optional(),
  metadata: z.object({
    order_id: z.string().uuid()
  }).optional()
});

export type PaystackInitialization = {
  email: string;
  amount: number;
  callback_url: string;
  metadata: {
    order_id: string;
    customer_name: string;
  };
};

export class PaystackApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "PaystackApiError";
  }
}

async function requestPaystack<T>(
  secretKey: string,
  path: string,
  responseSchema: z.ZodType<T>,
  init: RequestInit
): Promise<T> {
  const response = await fetch(`${PAYSTACK_API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...init.headers
    }
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new PaystackApiError("Paystack returned an invalid response.", response.status);
  }

  const envelope = envelopeSchema.safeParse(body);
  if (!envelope.success) {
    throw new PaystackApiError("Paystack returned an invalid response.", response.status);
  }

  if (!response.ok || !envelope.data.status) {
    throw new PaystackApiError(
      envelope.data.message || "Paystack request failed.",
      response.status
    );
  }

  const data = responseSchema.safeParse(envelope.data.data);
  if (!data.success) {
    throw new PaystackApiError("Paystack returned unexpected transaction data.", response.status);
  }

  return data.data;
}

export function createPaystackClient(secretKey: string | undefined) {
  const key = secretKey?.trim();
  if (!key) {
    throw new PaystackApiError("Paystack configuration missing.");
  }

  return {
    transaction: {
      initialize(input: PaystackInitialization) {
        if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
          throw new PaystackApiError("Paystack amount must be a positive integer.");
        }

        return requestPaystack(key, "/transaction/initialize", initializeResponseSchema, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
      },
      verify(reference: string) {
        if (!reference.trim()) {
          throw new PaystackApiError("Payment reference is required.");
        }

        return requestPaystack(
          key,
          `/transaction/verify/${encodeURIComponent(reference)}`,
          verifyResponseSchema,
          { method: "GET" }
        );
      }
    }
  };
}
