import { describe, expect, it } from "vitest";
import {
  defaultPaymentProviderSettings,
  getPaymentProviderReadiness,
  paymentProviderSettingsSchema,
} from "./payment-provider-options";

describe("payment provider settings", () => {
  it("defaults to Pesapal enabled and Paystack disabled pending credentials", () => {
    expect(defaultPaymentProviderSettings).toEqual({
      onlinePesapalEnabled: true,
      posPesapalEnabled: true,
      onlinePaystackEnabled: false,
    });
  });

  it("requires booleans for every persisted provider switch", () => {
    expect(paymentProviderSettingsSchema.safeParse(defaultPaymentProviderSettings).success).toBe(true);
    expect(paymentProviderSettingsSchema.safeParse({
      ...defaultPaymentProviderSettings,
      onlinePaystackEnabled: "true",
    }).success).toBe(false);
  });

  it("never reports an enabled method without its server credentials", () => {
    const readiness = getPaymentProviderReadiness({
      ...defaultPaymentProviderSettings,
      onlinePaystackEnabled: true,
    }, {
      pesapalConfigured: false,
      paystackMode: null,
    });

    expect(readiness.pesapal.online).toBe(false);
    expect(readiness.paystack.online).toBe(false);
  });

  it("reports only methods both configured and enabled", () => {
    const readiness = getPaymentProviderReadiness({
      ...defaultPaymentProviderSettings,
      onlinePaystackEnabled: true,
      posPesapalEnabled: false,
    }, {
      pesapalConfigured: true,
      paystackMode: "test",
    });

    expect(readiness.pesapal).toEqual({ configured: true, online: true, pos: false });
    expect(readiness.paystack).toEqual({ mode: "test", online: true });
  });
});
