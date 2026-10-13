import "server-only";

import { z } from "zod";

const PAYWAVE_API_URL = "https://paywavexpress.co.ke";

const textOrNumberSchema = z.union([z.string(), z.number()]);
const stkPushResponseSchema = z.object({
  ResponseCode: textOrNumberSchema,
  success: textOrNumberSchema.optional(),
  message: z.string().optional(),
  transaction_request_id: z.string().min(1),
  MerchantRequestID: z.string().optional(),
  CheckoutRequestID: z.string().optional(),
});

const transactionStatusSchema = z.object({
  ResultCode: textOrNumberSchema,
  ResultDesc: z.string().optional(),
  TransactionStatus: z.enum(["Pending", "Completed", "Failed", "Cancelled"]),
  TransactionReceipt: z.string().optional(),
  TransactionAmount: textOrNumberSchema,
  Msisdn: z.string().optional(),
  TransactionDate: z.string().optional(),
  TransactionReference: z.string().min(1),
  CheckoutRequestID: z.string().optional(),
  MerchantRequestID: z.string().optional(),
});

export type PaywaveTransactionStatus = z.infer<typeof transactionStatusSchema>;
export type PaywaveStkPushResponse = z.infer<typeof stkPushResponseSchema>;

export class PaywaveApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "PaywaveApiError";
  }
}

export class PaywaveConfigurationError extends Error {
  constructor() {
    super("Paywave Express server configuration is incomplete.");
    this.name = "PaywaveConfigurationError";
  }
}

export function isPaywaveConfigured() {
  const apiKey = process.env.PAYWAVE_EXPRESS_API_KEY?.trim();
  const email = process.env.PAYWAVE_EXPRESS_EMAIL?.trim();
  return Boolean(apiKey && email && z.string().email().safeParse(email).success);
}

function getCredentials() {
  const apiKey = process.env.PAYWAVE_EXPRESS_API_KEY?.trim();
  const email = process.env.PAYWAVE_EXPRESS_EMAIL?.trim();
  const accountNumber = process.env.PAYWAVE_EXPRESS_ACCOUNT_NUMBER?.trim();
  if (!apiKey || !email || !z.string().email().safeParse(email).success) {
    throw new PaywaveConfigurationError();
  }
  return { apiKey, email, accountNumber };
}

async function postPaywave<T>(
  path: string,
  responseSchema: z.ZodType<T>,
  body: Record<string, string>,
) {
  const response = await fetch(`${PAYWAVE_API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PaywaveApiError("Paywave Express returned an invalid response.", response.status);
  }

  if (!response.ok) {
    throw new PaywaveApiError("Paywave Express could not process the request.", response.status);
  }

  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new PaywaveApiError("Paywave Express returned unexpected transaction data.", response.status);
  }
  return parsed.data;
}

export function createPaywaveClient() {
  const credentials = getCredentials();
  return {
    stkPush(input: { amount: string; msisdn: string; reference: string }) {
      return postPaywave("/v1/stkpush", stkPushResponseSchema, {
        api_key: credentials.apiKey,
        email: credentials.email,
        ...input,
        ...(credentials.accountNumber ? { account_number: credentials.accountNumber } : {}),
      }).then((result) => {
        if (String(result.ResponseCode) !== "0" || String(result.success ?? "200") !== "200") {
          throw new PaywaveApiError("Paywave Express did not accept the M-Pesa payment request.", 400);
        }
        return result;
      });
    },
    verify(transactionRequestId: string) {
      return postPaywave("/v1/tstatus", transactionStatusSchema, {
        api_key: credentials.apiKey,
        email: credentials.email,
        transaction_request_id: transactionRequestId,
      }).then((result) => {
        if (String(result.ResultCode) !== "200") {
          throw new PaywaveApiError("Paywave Express could not verify the M-Pesa transaction.", 502);
        }
        return result;
      });
    },
  };
}
