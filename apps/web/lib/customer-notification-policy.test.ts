import { describe, expect, it } from "vitest";
import {
  customerEmailDeliveryAllowed,
  customerPushDeliveryAllowed,
  safeInternalNotificationHref,
  validatePushSubscription,
} from "./customer-notification-policy";

const optedInPreferences = {
  transactional_email: true,
  marketing_email: true,
  push_enabled: true,
  push_marketing: true,
  promotions_opt_in: true,
  products_opt_in: true,
};

describe("customer notification delivery policy", () => {
  it("blocks promotional delivery after consent or channel opt-out", () => {
    expect(customerEmailDeliveryAllowed("promotion", {
      ...optedInPreferences,
      promotions_opt_in: false,
    })).toBe(false);
    expect(customerEmailDeliveryAllowed("product", {
      ...optedInPreferences,
      marketing_email: false,
    })).toBe(false);
    expect(customerPushDeliveryAllowed("promotion", {
      ...optedInPreferences,
      push_marketing: false,
    })).toBe(false);
    expect(customerPushDeliveryAllowed("product", {
      ...optedInPreferences,
      products_opt_in: false,
    })).toBe(false);
  });

  it("keeps transactional messages independent from marketing consent", () => {
    const optedOut = {
      ...optedInPreferences,
      marketing_email: false,
      promotions_opt_in: false,
      products_opt_in: false,
      push_marketing: false,
    };
    expect(customerEmailDeliveryAllowed("order", optedOut)).toBe(true);
    expect(customerPushDeliveryAllowed("quotation", optedOut)).toBe(true);
    expect(customerEmailDeliveryAllowed("back_in_stock", optedInPreferences)).toBe(false);
  });

  it("accepts only same-origin notification paths", () => {
    expect(safeInternalNotificationHref("/account/orders/abc")).toBe("/account/orders/abc");
    expect(safeInternalNotificationHref("//attacker.example")).toBe("/account/notifications");
    expect(safeInternalNotificationHref("/\\attacker.example")).toBe("/account/notifications");
    expect(safeInternalNotificationHref("https://attacker.example")).toBe("/account/notifications");
  });

  it("restricts push subscriptions to HTTPS browser push endpoints", () => {
    expect(validatePushSubscription({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "public-key", auth: "auth-secret" },
    }).endpoint).toBe("https://fcm.googleapis.com/fcm/send/abc");
    expect(() => validatePushSubscription({
      endpoint: "http://127.0.0.1:54321/",
      keys: { p256dh: "public-key", auth: "auth-secret" },
    })).toThrow("This browser push provider is not supported.");
    expect(() => validatePushSubscription({
      endpoint: "https://fcm.googleapis.com.evil.example/",
      keys: { p256dh: "public-key", auth: "auth-secret" },
    })).toThrow("This browser push provider is not supported.");
  });
});
