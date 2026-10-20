import "server-only";

import { createCipheriv, createDecipheriv, createECDH, createHash, randomBytes } from "node:crypto";
import webpush from "web-push";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type {
  CustomerNotificationDelivery,
  CustomerNotificationDeliveryInsert,
  CustomerNotificationType,
} from "@dantown/database";
import type { CustomerNotificationPreferences } from "@/lib/customer-notification-types";
import {
  customerEmailDeliveryAllowed,
  customerPushDeliveryAllowed,
  safeInternalNotificationHref,
  type PushSubscriptionInput,
} from "@/lib/customer-notification-policy";

const MAX_ATTEMPTS = 5;
function getEncryptionKey() {
  const encoded = process.env.CUSTOMER_PUSH_ENCRYPTION_KEY;
  if (!encoded) throw new Error("Customer push encryption is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.byteLength !== 32) throw new Error("Customer push encryption key must decode to 32 bytes.");
  return key;
}

function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

function decryptSecret(value: string) {
  const [ivValue, tagValue, ciphertextValue] = value.split(".");
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error("Stored push subscription is invalid.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function hashPushEndpoint(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject || !isCustomerPushConfigured()) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export function isCustomerPushConfigured() {
  try {
    const publicKeyValue = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKeyValue = process.env.VAPID_PRIVATE_KEY;
    const subjectValue = process.env.VAPID_SUBJECT;
    if (!publicKeyValue || !privateKeyValue || !subjectValue) {
      return false;
    }
    const subject = new URL(subjectValue);
    if (!["mailto:", "https:"].includes(subject.protocol)) return false;
    const publicKey = Buffer.from(publicKeyValue, "base64url");
    const privateKey = Buffer.from(privateKeyValue, "base64url");
    if (publicKey.byteLength !== 65 || privateKey.byteLength !== 32) return false;
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(privateKey);
    if (!ecdh.getPublicKey().equals(publicKey)) return false;
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function retryDelaySeconds(attempt: number) {
  return Math.min(60 * 2 ** Math.max(attempt - 1, 0), 3600);
}

function isQuietHours(
  preferences: Pick<CustomerNotificationPreferences, "quiet_start" | "quiet_end" | "timezone">,
  now = new Date(),
) {
  if (!preferences.quiet_start || !preferences.quiet_end) return false;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: preferences.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    return false;
  }
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const currentMinutes = hour * 60 + minute;
  const [startHour, startMinute] = preferences.quiet_start.split(":").map(Number);
  const [endHour, endMinute] = preferences.quiet_end.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return start === end ? false : start < end
    ? currentMinutes >= start && currentMinutes < end
    : currentMinutes >= start || currentMinutes < end;
}

function nextQuietEnd(
  preferences: Pick<CustomerNotificationPreferences, "quiet_start" | "quiet_end" | "timezone">,
  now = new Date(),
) {
  for (let minute = 1; minute <= 24 * 60; minute += 1) {
    const candidate = new Date(now.getTime() + minute * 60_000);
    if (!isQuietHours(preferences, candidate)) return candidate.toISOString();
  }
  return new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
}

async function finishDelivery(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  delivery: CustomerNotificationDelivery,
  status: CustomerNotificationDelivery["status"],
  details: { providerReference?: string | null; error?: string | null; availableAt?: string } = {},
) {
  const patch: Partial<CustomerNotificationDeliveryInsert> = {
    status,
    claimed_by: null,
    claimed_at: null,
    updated_at: new Date().toISOString(),
    provider_reference: details.providerReference ?? null,
    last_error: details.error ?? null,
  };
  if (status === "SENT") patch.sent_at = new Date().toISOString();
  if (details.availableAt) patch.available_at = details.availableAt;
  const { error } = await supabase
    .from("customer_notification_deliveries")
    .update(patch)
    .eq("id", delivery.id)
    .eq("status", "PROCESSING")
    .eq("claimed_by", delivery.claimed_by ?? "");
  if (error) throw error;
}

async function deferDelivery(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  delivery: CustomerNotificationDelivery,
  availableAt: string,
  reason: string,
) {
  const { error } = await supabase
    .from("customer_notification_deliveries")
    .update({
      status: "RETRY",
      attempts: Math.max(delivery.attempts - 1, 0),
      available_at: availableAt,
      claimed_by: null,
      claimed_at: null,
      last_error: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", delivery.id)
    .eq("status", "PROCESSING")
    .eq("claimed_by", delivery.claimed_by ?? "");
  if (error) throw error;
}

async function deliverEmail(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  delivery: CustomerNotificationDelivery,
  notification: { title: string; body: string; href: string; type: CustomerNotificationType },
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CUSTOMER_EMAIL_FROM;
  if (!apiKey || !from) {
    await finishDelivery(supabase, delivery, "SKIPPED", { error: "email_provider_not_configured" });
    return;
  }

  const { data: preferences, error: preferenceError } = await supabase
    .from("customer_notification_preferences")
    .select("transactional_email,marketing_email,promotions_opt_in,products_opt_in")
    .eq("user_id", delivery.user_id)
    .maybeSingle();
  if (preferenceError) throw preferenceError;
  if (!customerEmailDeliveryAllowed(notification.type, preferences)) {
    await finishDelivery(supabase, delivery, "SKIPPED", { error: "email_preference_disabled" });
    return;
  }

  const { data, error } = await supabase.auth.admin.getUserById(delivery.user_id);
  if (error) throw new Error("Unable to resolve the notification recipient.");
  const email = data.user?.email;
  if (!email) {
    await finishDelivery(supabase, delivery, "SKIPPED", { error: "recipient_email_unavailable" });
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://dan-town-ecomers.vercel.app";
  const href = new URL(safeInternalNotificationHref(notification.href), appUrl).toString();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": delivery.idempotency_key,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: notification.title,
      html: `<main style="font-family:Arial,sans-serif;color:#0b1b2e"><h1>${escapeHtml(notification.title)}</h1><p>${escapeHtml(notification.body)}</p><p><a href="${escapeHtml(href)}">View this update in your Dantown account</a></p><p><a href="${escapeHtml(new URL("/account/settings", appUrl).toString())}">Manage notification preferences</a></p></main>`,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    const failed = !retryable || delivery.attempts >= MAX_ATTEMPTS;
    await finishDelivery(supabase, delivery, failed ? "FAILED" : "RETRY", {
      error: `email_http_${response.status}`,
      availableAt: new Date(Date.now() + retryDelaySeconds(delivery.attempts) * 1000).toISOString(),
    });
    return;
  }

  const result = await response.json().catch(() => null) as { id?: string } | null;
  await finishDelivery(supabase, delivery, "SENT", { providerReference: result?.id ?? null });
}

async function deliverPush(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  delivery: CustomerNotificationDelivery,
  notification: { title: string; body: string; href: string; type: CustomerNotificationType },
) {
  if (!configureWebPush()) {
    await finishDelivery(supabase, delivery, "SKIPPED", { error: "push_provider_not_configured" });
    return;
  }
  if (!delivery.subscription_id) {
    await finishDelivery(supabase, delivery, "SKIPPED", { error: "push_subscription_unavailable" });
    return;
  }

  const { data: preferences, error: preferenceError } = await supabase
    .from("customer_notification_preferences")
    .select("push_enabled,push_marketing,promotions_opt_in,products_opt_in,quiet_start,quiet_end,timezone")
    .eq("user_id", delivery.user_id)
    .maybeSingle();
  if (preferenceError) throw preferenceError;
  if (!customerPushDeliveryAllowed(notification.type, preferences)) {
    await finishDelivery(supabase, delivery, "SKIPPED", { error: "push_preference_disabled" });
    return;
  }
  if (
    ["promotion", "product", "back_in_stock"].includes(notification.type) &&
    preferences &&
    isQuietHours(preferences)
  ) {
    await deferDelivery(
      supabase,
      delivery,
      nextQuietEnd(preferences),
      "deferred_for_quiet_hours",
    );
    return;
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("customer_push_subscriptions")
    .select("id,endpoint_hash,endpoint_ciphertext,p256dh_ciphertext,auth_ciphertext,active,failure_count")
    .eq("id", delivery.subscription_id)
    .eq("user_id", delivery.user_id)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;
  if (!subscription?.active) {
    await finishDelivery(supabase, delivery, "SKIPPED", { error: "push_subscription_inactive" });
    return;
  }

  const target = {
    endpoint: decryptSecret(subscription.endpoint_ciphertext),
    keys: {
      p256dh: decryptSecret(subscription.p256dh_ciphertext),
      auth: decryptSecret(subscription.auth_ciphertext),
    },
  };
  try {
    const response = await webpush.sendNotification(
      target,
      JSON.stringify({
        title: "Dantown account update",
        body: "Sign in to see your latest update.",
        url: safeInternalNotificationHref(notification.href),
      }),
      { TTL: 3600, urgency: "normal" },
    );
    await finishDelivery(supabase, delivery, "SENT", {
      providerReference: String(response.statusCode),
    });
    await supabase
      .from("customer_push_subscriptions")
      .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
      .eq("id", subscription.id)
      .eq("user_id", delivery.user_id);
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error
      ? Number(error.statusCode)
      : 0;
    if (statusCode === 404 || statusCode === 410) {
      await supabase
        .from("customer_push_subscriptions")
        .update({ active: false, revoked_at: new Date().toISOString() })
        .eq("id", subscription.id)
        .eq("user_id", delivery.user_id);
      await finishDelivery(supabase, delivery, "SKIPPED", { error: "push_subscription_expired" });
      return;
    }

    const retryable = statusCode === 0 || statusCode === 429 || statusCode >= 500;
    await supabase
      .from("customer_push_subscriptions")
      .update({ failure_count: subscription.failure_count + 1 })
      .eq("id", subscription.id)
      .eq("user_id", delivery.user_id);
    await finishDelivery(
      supabase,
      delivery,
      !retryable || delivery.attempts >= MAX_ATTEMPTS ? "FAILED" : "RETRY",
      {
        error: statusCode ? `push_http_${statusCode}` : "push_delivery_failed",
        availableAt: new Date(Date.now() + retryDelaySeconds(delivery.attempts) * 1000).toISOString(),
      },
    );
  }
}

export async function dispatchCustomerNotificationBatch(limit = 50) {
  const supabase = createSupabaseServiceClient();
  const workerId = `web-${randomBytes(12).toString("hex")}`;
  const { data: promotionsQueued, error: promotionError } = await supabase
    .rpc("enqueue_customer_promotion_notifications_worker");
  if (promotionError) throw promotionError;
  const { data: quotesQueued, error: quoteError } = await supabase
    .rpc("enqueue_customer_quote_expiry_notifications_worker");
  if (quoteError) throw quoteError;

  const { data: deliveries, error } = await supabase.rpc("claim_customer_notification_deliveries", {
    worker_id: workerId,
    batch_size: Math.min(Math.max(Math.floor(limit), 1), 100),
  });
  if (error) throw error;

  let sent = 0;
  let retried = 0;
  let failed = 0;
  let skipped = 0;
  for (const delivery of deliveries ?? []) {
    try {
      const { data: notification, error: notificationError } = await supabase
        .from("customer_notifications")
        .select("title,body,href,type")
        .eq("id", delivery.notification_id)
        .eq("user_id", delivery.user_id)
        .maybeSingle();
      if (notificationError) throw notificationError;
      if (!notification) {
        await finishDelivery(supabase, delivery, "SKIPPED", { error: "notification_unavailable" });
        continue;
      }
      if (delivery.channel === "email") {
        await deliverEmail(supabase, delivery, notification);
      } else {
        await deliverPush(supabase, delivery, notification);
      }
    } catch (error) {
      console.error("Customer notification delivery failed", {
        deliveryId: delivery.id,
        channel: delivery.channel,
        message: error instanceof Error ? error.message : "unknown_error",
      });
      await finishDelivery(
        supabase,
        delivery,
        delivery.attempts >= MAX_ATTEMPTS ? "FAILED" : "RETRY",
        {
          error: "delivery_processing_failed",
          availableAt: new Date(Date.now() + retryDelaySeconds(delivery.attempts) * 1000).toISOString(),
        },
      );
    }
  }

  const states = await supabase
    .from("customer_notification_deliveries")
    .select("status")
    .in("id", (deliveries ?? []).map((delivery) => delivery.id));
  if (states.error) throw states.error;
  for (const state of states.data ?? []) {
    if (state.status === "SENT") sent += 1;
    if (state.status === "RETRY") retried += 1;
    if (state.status === "FAILED") failed += 1;
    if (state.status === "SKIPPED") skipped += 1;
  }

  return {
    promotionsQueued: promotionsQueued ?? 0,
    quotesQueued: quotesQueued ?? 0,
    claimed: deliveries?.length ?? 0,
    sent,
    retried,
    failed,
    skipped,
  };
}

export async function sendCustomerPushTest(userId: string) {
  const supabase = createSupabaseServiceClient();
  if (!configureWebPush()) throw new Error("Browser push delivery is not configured.");
  const { data: preferences, error: preferencesError } = await supabase
    .from("customer_notification_preferences")
    .select("push_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (preferencesError) throw preferencesError;
  if (!preferences?.push_enabled) throw new Error("Enable browser push on this device before sending a test.");
  const { data: subscriptions, error } = await supabase
    .from("customer_push_subscriptions")
    .select("id,endpoint_ciphertext,p256dh_ciphertext,auth_ciphertext")
    .eq("user_id", userId)
    .eq("active", true);
  if (error) throw error;
  if (!subscriptions?.length) throw new Error("Enable browser push on this device before sending a test.");

  const { data: notification, error: notificationError } = await supabase
    .from("customer_notifications")
    .insert({
      user_id: userId,
      type: "account",
      title: "Test push notification",
      body: "Your browser push notification is working.",
      href: "/account/notifications",
      related_type: null,
      related_id: null,
      event_key: `push-test:${randomBytes(16).toString("hex")}`,
    })
    .select("id")
    .single();
  if (notificationError) throw notificationError;

  const { error: skipEmailError } = await supabase
    .from("customer_notification_deliveries")
    .update({ status: "SKIPPED", last_error: "push_test_only" })
    .eq("notification_id", notification.id)
    .eq("channel", "email");
  if (skipEmailError) throw skipEmailError;

  const { data: pendingDeliveries, error: pendingError } = await supabase
    .from("customer_notification_deliveries")
    .select("id,subscription_id,attempts")
    .eq("notification_id", notification.id)
    .eq("channel", "push")
    .eq("status", "PENDING");
  if (pendingError) throw pendingError;
  if (!pendingDeliveries?.length) {
    return { sent: 0, failed: 0 };
  }
  const { data: queuedDeliveries, error: claimError } = await supabase
    .from("customer_notification_deliveries")
    .update({
      status: "PROCESSING",
      attempts: 1,
      claimed_by: "push-test",
      claimed_at: new Date().toISOString(),
    })
    .in("id", pendingDeliveries.map((delivery) => delivery.id))
    .eq("status", "PENDING")
    .select("id,subscription_id,attempts");
  if (claimError) throw claimError;
  const result: { sent: number; failed: number } = { sent: 0, failed: 0 };
  for (const delivery of queuedDeliveries ?? []) {
    const subscription = subscriptions.find((item) => item.id === delivery.subscription_id);
    if (!subscription) continue;
    try {
      const response = await webpush.sendNotification(
        {
          endpoint: decryptSecret(subscription.endpoint_ciphertext),
          keys: {
            p256dh: decryptSecret(subscription.p256dh_ciphertext),
            auth: decryptSecret(subscription.auth_ciphertext),
          },
        },
        JSON.stringify({
          title: "Dantown push test",
          body: "Your browser push notifications are enabled.",
          url: "/account/notifications",
        }),
        { TTL: 60, urgency: "normal" },
      );
      const { error: sentError } = await supabase
        .from("customer_notification_deliveries")
        .update({
          status: "SENT",
          sent_at: new Date().toISOString(),
          provider_reference: String(response.statusCode),
          claimed_by: null,
          claimed_at: null,
        })
        .eq("id", delivery.id)
        .eq("status", "PROCESSING")
        .eq("claimed_by", "push-test");
      if (sentError) throw sentError;
      result.sent += 1;
    } catch (pushError) {
      const statusCode = typeof pushError === "object" && pushError && "statusCode" in pushError
        ? Number(pushError.statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) {
        await supabase
          .from("customer_push_subscriptions")
          .update({ active: false, revoked_at: new Date().toISOString() })
          .eq("id", subscription.id)
          .eq("user_id", userId);
      }
      const { error: failedError } = await supabase
        .from("customer_notification_deliveries")
        .update({
          status: "FAILED",
          last_error: statusCode ? `push_http_${statusCode}` : "push_test_failed",
          claimed_by: null,
          claimed_at: null,
        })
        .eq("id", delivery.id)
        .eq("status", "PROCESSING")
        .eq("claimed_by", "push-test");
      if (failedError) throw failedError;
      result.failed += 1;
    }
  }
  return result;
}

export function encryptCustomerPushSubscription(subscription: PushSubscriptionInput) {
  return {
    endpoint_hash: hashPushEndpoint(subscription.endpoint),
    endpoint_ciphertext: encryptSecret(subscription.endpoint),
    p256dh_ciphertext: encryptSecret(subscription.keys.p256dh),
    auth_ciphertext: encryptSecret(subscription.keys.auth),
  };
}

export function getCustomerPushPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}
