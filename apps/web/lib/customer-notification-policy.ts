import type { CustomerNotificationType } from "@dantown/database";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const safePushHostSuffixes = [
  ".googleapis.com",
  ".mozilla.com",
  ".push.apple.com",
  ".notify.windows.com",
] as const;

export function safeInternalNotificationHref(href: string) {
  if (!href.startsWith("/") || href.startsWith("//") || href.includes("\\") || /[\u0000-\u001f]/.test(href)) {
    return "/account/notifications";
  }
  try {
    const base = "https://dantown.invalid";
    const parsed = new URL(href, base);
    return parsed.origin === base
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "/account/notifications";
  } catch {
    return "/account/notifications";
  }
}

export function validatePushSubscription(value: unknown): PushSubscriptionInput {
  if (!isRecord(value) || !isRecord(value.keys)) {
    throw new Error("Choose a valid browser push subscription.");
  }

  if (
    typeof value.endpoint !== "string" ||
    value.endpoint.length > 2048 ||
    typeof value.keys.p256dh !== "string" ||
    value.keys.p256dh.length > 256 ||
    typeof value.keys.auth !== "string" ||
    value.keys.auth.length > 256
  ) {
    throw new Error("Choose a valid browser push subscription.");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(value.endpoint);
  } catch {
    throw new Error("Choose a valid browser push endpoint.");
  }

  const hostAllowed = safePushHostSuffixes.some((suffix) => endpoint.hostname.endsWith(suffix));
  if (
    endpoint.protocol !== "https:" ||
    endpoint.port !== "" ||
    endpoint.username ||
    endpoint.password ||
    !hostAllowed
  ) {
    throw new Error("This browser push provider is not supported.");
  }

  return {
    endpoint: endpoint.href,
    keys: { p256dh: value.keys.p256dh, auth: value.keys.auth },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type EmailDeliveryPreferences = {
  transactional_email: boolean;
  marketing_email: boolean;
  promotions_opt_in: boolean;
  products_opt_in: boolean;
};

type PushDeliveryPreferences = Pick<EmailDeliveryPreferences, "promotions_opt_in" | "products_opt_in"> & {
  push_enabled: boolean;
  push_marketing: boolean;
};

export type CustomerNotificationCategory = CustomerNotificationType;

export function customerEmailDeliveryAllowed(
  type: CustomerNotificationCategory,
  preferences: EmailDeliveryPreferences | null,
) {
  if (type === "back_in_stock") return false;
  if (type === "promotion") {
    return Boolean(preferences?.marketing_email && preferences.promotions_opt_in);
  }
  if (type === "product") {
    return Boolean(preferences?.marketing_email && preferences.products_opt_in);
  }
  return preferences?.transactional_email ?? true;
}

export function customerPushDeliveryAllowed(
  type: CustomerNotificationCategory,
  preferences: PushDeliveryPreferences | null,
) {
  if (!preferences?.push_enabled) return false;
  if (type === "promotion") return preferences.push_marketing && preferences.promotions_opt_in;
  if (type === "product") return preferences.push_marketing && preferences.products_opt_in;
  return true;
}
