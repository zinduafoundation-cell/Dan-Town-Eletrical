import "server-only";

import { createHmac, randomUUID } from "node:crypto";

import type { DomainEvent } from "@dantown/database";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const MAX_BATCH_SIZE = 100;
const MAX_DELIVERY_BYTES = 64 * 1024;
const DELIVERY_TIMEOUT_MS = 8_000;

type OutboxWebhook = {
  endpoint: URL;
  secret: string;
};

export type OutboxDispatchResult = {
  enabled: boolean;
  claimed: number;
  delivered: number;
  retried: number;
  deadLettered: number;
};

function getWebhook(): OutboxWebhook | null {
  const endpointValue = process.env.DANTOWN_DOMAIN_EVENT_WEBHOOK_URL;
  const secret = process.env.DANTOWN_DOMAIN_EVENT_WEBHOOK_SECRET;
  if (!endpointValue || !secret) return null;

  const endpoint = new URL(endpointValue);
  if (endpoint.protocol !== "https:") {
    throw new Error("DANTOWN_DOMAIN_EVENT_WEBHOOK_URL must use HTTPS.");
  }

  return { endpoint, secret };
}

function toWebhookPayload(event: DomainEvent) {
  return JSON.stringify({
    id: event.id,
    name: event.event_name,
    aggregate: { type: event.aggregate_type, id: event.aggregate_id },
    correlationId: event.correlation_id,
    actorUserId: event.actor_user_id,
    occurredAt: event.created_at,
    payload: event.payload,
  });
}

async function deliverEvent(event: DomainEvent, webhook: OutboxWebhook) {
  const payload = toWebhookPayload(event);
  if (Buffer.byteLength(payload, "utf8") > MAX_DELIVERY_BYTES) {
    throw new Error("Event payload exceeds the configured delivery limit.");
  }

  const signature = createHmac("sha256", webhook.secret).update(payload).digest("hex");
  const response = await fetch(webhook.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Dantown-Event-Id": event.id,
      "X-Dantown-Event-Name": event.event_name,
      "X-Dantown-Event-Signature": `sha256=${signature}`,
    },
    body: payload,
    cache: "no-store",
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`Webhook responded with HTTP ${response.status}.`);
}

function safeFailureMessage(error: unknown) {
  if (error instanceof Error && /^Webhook responded with HTTP \d{3}\.$/.test(error.message)) return error.message;
  if (error instanceof Error && error.message === "Event payload exceeds the configured delivery limit.") return error.message;
  return "Webhook delivery failed.";
}

export async function dispatchDomainEventBatch(limit = 20): Promise<OutboxDispatchResult> {
  const webhook = getWebhook();
  if (!webhook) {
    return { enabled: false, claimed: 0, delivered: 0, retried: 0, deadLettered: 0 };
  }

  const supabase = createSupabaseServiceClient();
  const workerId = `web-${process.env.VERCEL_REGION ?? "local"}-${randomUUID()}`;
  const batchSize = Math.min(Math.max(Math.floor(limit), 1), MAX_BATCH_SIZE);
  const { data: claimedEvents, error: claimError } = await supabase.rpc("claim_domain_events", {
    worker_id: workerId,
    batch_size: batchSize,
    lease_seconds: 120,
  });
  if (claimError) throw claimError;

  const result: OutboxDispatchResult = {
    enabled: true,
    claimed: claimedEvents?.length ?? 0,
    delivered: 0,
    retried: 0,
    deadLettered: 0,
  };

  for (const event of claimedEvents ?? []) {
    try {
      await deliverEvent(event, webhook);
      const { data: acknowledged, error: acknowledgeError } = await supabase.rpc("ack_domain_event", {
        event_id: event.id,
        worker_id: workerId,
      });
      if (acknowledgeError || !acknowledged) throw acknowledgeError ?? new Error("Event lease expired before acknowledgement.");
      result.delivered += 1;
    } catch (error) {
      const { data: status, error: retryError } = await supabase.rpc("retry_domain_event", {
        event_id: event.id,
        worker_id: workerId,
        failure_reason: safeFailureMessage(error),
      });
      if (retryError) throw retryError;
      if (status === "DEAD_LETTER") result.deadLettered += 1;
      else result.retried += 1;
    }
  }

  return result;
}
