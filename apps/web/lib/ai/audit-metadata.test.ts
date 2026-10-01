import { describe, expect, it } from "vitest";

import { buildAiInteractionAuditMetadata } from "./audit-metadata";

describe("AI interaction audit metadata", () => {
  it("records only operational metadata, never prompts, history, context, or answers", () => {
    const metadata = buildAiInteractionAuditMetadata({
      request_id: "6e5bdf3e-79da-4a5f-b518-1ef3c1bbf55f",
      surface: "centre",
      outcome: "HELD",
      approved_tool: "authorization",
      provider: "responses",
      latency_ms: 24.7,
    });

    expect(metadata).toEqual({
      audit_schema: "dantown.ai-interaction.v1",
      request_id: "6e5bdf3e-79da-4a5f-b518-1ef3c1bbf55f",
      surface: "centre",
      outcome: "HELD",
      approved_tool: "authorization",
      provider: "responses",
      latency_ms: 25,
    });
    expect(Object.keys(metadata)).not.toEqual(expect.arrayContaining(["prompt", "message", "history", "context", "answer"]));
  });
});
