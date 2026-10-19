import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getPaystackMode } from "./paystack-mode";
import { getPesapalConfig } from "./pesapal";
import {
  defaultPaymentProviderSettings,
  getPaymentProviderReadiness,
  paymentProviderSettingsSchema,
  type PaymentProviderSettings,
} from "./payment-provider-options";
export { paymentProviderSettingsSchema } from "./payment-provider-options";
export type { PaymentProviderSettings } from "./payment-provider-options";

export async function loadPaymentProviderSettings() {
  const { data, error } = await createSupabaseServiceClient()
    .from("payment_provider_settings")
    .select("online_pesapal_enabled,pos_pesapal_enabled,online_paystack_enabled,updated_at")
    .eq("id", "dantown")
    .maybeSingle();
  if (error) throw error;

  const parsed = paymentProviderSettingsSchema.safeParse(data ? {
    onlinePesapalEnabled: data.online_pesapal_enabled,
    posPesapalEnabled: data.pos_pesapal_enabled,
    onlinePaystackEnabled: data.online_paystack_enabled,
  } : defaultPaymentProviderSettings);
  if (!parsed.success) throw new Error("Saved payment provider settings are invalid.");

  return {
    settings: parsed.data,
    updatedAt: data?.updated_at ?? null,
  };
}

export async function loadPaymentProviderReadiness(settings: PaymentProviderSettings) {
  return getPaymentProviderReadiness(settings, {
    pesapalConfigured: Boolean(getPesapalConfig()),
    paystackMode: getPaystackMode(),
  });
}

export async function savePaymentProviderSettings(
  settings: PaymentProviderSettings,
  updatedBy: string | null,
) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("payment_provider_settings")
    .upsert({
      id: "dantown",
      online_pesapal_enabled: settings.onlinePesapalEnabled,
      pos_pesapal_enabled: settings.posPesapalEnabled,
      online_paystack_enabled: settings.onlinePaystackEnabled,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .select("updated_at")
    .single();
  if (error) throw error;
  return data.updated_at;
}

export async function isPaymentProviderAvailable(
  channel: "online" | "pos",
  provider: "pesapal" | "paystack",
) {
  const { settings } = await loadPaymentProviderSettings();
  const readiness = await loadPaymentProviderReadiness(settings);
  return provider === "pesapal"
    ? readiness.pesapal[channel]
    : channel === "online" && readiness.paystack.online;
}
