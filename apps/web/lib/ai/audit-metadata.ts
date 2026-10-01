import type { AiSurface } from "./surface";

export type AiInteractionOutcome = "COMPLETED" | "HELD" | "DENIED" | "FAILED";
export type AiInteractionProvider = "responses" | "legacy-compatible" | "not-invoked";

export type AiInteractionAuditMetadata = {
  audit_schema: "dantown.ai-interaction.v1";
  request_id: string;
  surface: AiSurface;
  outcome: AiInteractionOutcome;
  approved_tool: string | null;
  provider: AiInteractionProvider;
  latency_ms: number;
};

export function buildAiInteractionAuditMetadata(input: Omit<AiInteractionAuditMetadata, "audit_schema" | "latency_ms"> & { latency_ms: number }): AiInteractionAuditMetadata {
  return {
    audit_schema: "dantown.ai-interaction.v1",
    request_id: input.request_id,
    surface: input.surface,
    outcome: input.outcome,
    approved_tool: input.approved_tool,
    provider: input.provider,
    latency_ms: Math.max(0, Math.round(input.latency_ms)),
  };
}
