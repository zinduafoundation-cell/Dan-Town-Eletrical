import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/server";

import {
  buildAiInteractionAuditMetadata,
  type AiInteractionAuditMetadata,
} from "./audit-metadata";

export { type AiInteractionOutcome, type AiInteractionProvider } from "./audit-metadata";

type AiInteractionAuditInput = Omit<AiInteractionAuditMetadata, "audit_schema"> & {
  actorUserId: string | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function auditActorId(userId: string | null) {
  return userId && uuidPattern.test(userId) ? userId : null;
}

// Audit availability must never turn an already read-only AI request into a
// customer-facing failure. The record deliberately excludes prompts, history,
// tool payloads, and generated answers.
export async function recordAiInteraction(input: AiInteractionAuditInput) {
  try {
    const metadata = buildAiInteractionAuditMetadata(input);
    const { error } = await createSupabaseServiceClient().from("audit_logs").insert({
      user_id: auditActorId(input.actorUserId),
      action: `AI_INTERACTION_${metadata.outcome}`,
      resource_type: "ai_interaction",
      resource_id: null,
      new_data: metadata,
    });

    if (error) console.error("Unable to persist AI interaction audit metadata:", error);
  } catch (error) {
    console.error("Unable to initialize AI interaction audit metadata:", error);
  }
}
