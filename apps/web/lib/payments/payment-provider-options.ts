import { z } from "zod";

export const paymentProviderSettingsSchema = z.object({
  onlinePesapalEnabled: z.boolean(),
  posPesapalEnabled: z.boolean(),
  onlinePaystackEnabled: z.boolean(),
});

export type PaymentProviderSettings = z.infer<typeof paymentProviderSettingsSchema>;

export const defaultPaymentProviderSettings: PaymentProviderSettings = {
  onlinePesapalEnabled: true,
  posPesapalEnabled: true,
  onlinePaystackEnabled: false,
};

export type PaymentProviderReadiness = {
  pesapal: { configured: boolean; online: boolean; pos: boolean };
  paystack: { mode: "test" | "live" | null; online: boolean };
};

export const paymentProviderReadinessSchema = z.object({
  pesapal: z.object({ configured: z.boolean(), online: z.boolean(), pos: z.boolean() }),
  paystack: z.object({
    mode: z.enum(["test", "live"]).nullable(),
    online: z.boolean(),
  }),
});

export function getPaymentProviderReadiness(
  settings: PaymentProviderSettings,
  credentials: { pesapalConfigured: boolean; paystackMode: "test" | "live" | null },
): PaymentProviderReadiness {
  return {
    pesapal: {
      configured: credentials.pesapalConfigured,
      online: settings.onlinePesapalEnabled && credentials.pesapalConfigured,
      pos: settings.posPesapalEnabled && credentials.pesapalConfigured,
    },
    paystack: {
      mode: credentials.paystackMode,
      online: settings.onlinePaystackEnabled && credentials.paystackMode !== null,
    },
  };
}
