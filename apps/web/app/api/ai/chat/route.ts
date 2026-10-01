import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAuthorizationContext } from "@/lib/auth/server";
import { recordAiInteraction, type AiInteractionProvider } from "@/lib/ai/audit";
import { completeWithApprovedContext } from "@/lib/ai/provider";
import { runApprovedTool } from "@/lib/ai/tools";
import { isSurfaceAllowed, type AiSurface } from "@/lib/ai/surface";
import { AppError } from "@/lib/core/errors";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  surface: z.enum(["storefront", "centre", "pos", "admin"]).default("storefront"),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(3000) })).max(12).default([])
});

export async function POST(request: Request) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let auditContext: { actorUserId: string | null; surface: AiSurface } | null = null;
  const configuredProvider: AiInteractionProvider = process.env.AI_PROVIDER_BASE_URL ? "legacy-compatible" : "responses";

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please send a valid question." }, { status: 400 });

    const context = await getAuthorizationContext();
    const requestedSurface = parsed.data.surface as AiSurface;
    auditContext = { actorUserId: context?.userId ?? null, surface: requestedSurface };
    if (!isSurfaceAllowed(requestedSurface, context)) {
      await recordAiInteraction({
        ...auditContext,
        request_id: requestId,
        outcome: "DENIED",
        approved_tool: null,
        provider: "not-invoked",
        latency_ms: Date.now() - startedAt,
      });
      return NextResponse.json({ error: "You are not authorized to use this Dantown AI surface." }, { status: 403 });
    }

    const response = await completeWithApprovedContext({
      system: `You are DAN T AI ${requestedSurface === "storefront" ? "customer assistant" : requestedSurface === "centre" ? "business assistant" : requestedSurface === "pos" ? "POS assistant" : "admin intelligence"}. Use get_approved_dantown_context before stating any Dantown operational fact. Answer only from that approved, permission-filtered context. Never invent prices, stock, order status, payment confirmation, delivery promises, or policies. If data is missing, say that it cannot be confirmed. Make it concise and clearly label any recommendation as an AI recommendation or AI insight when advisory. You cannot create, change, approve, refund, transfer, or delete business data. Do not mention internal tools or secrets.`,
      history: parsed.data.history,
      question: `Surface: ${requestedSurface}\nQuestion: ${parsed.data.message}`,
      resolveApprovedContext: () => runApprovedTool(parsed.data.message, context, requestedSurface),
    });
    const escalationSuggested = /\b(human|agent|representative|complaint|complain|refund|charged|payment failed|speak to)\b/i.test(parsed.data.message) || (Array.isArray(response.toolResult?.data) && response.toolResult.data.length === 0);
    await recordAiInteraction({
      ...auditContext,
      request_id: requestId,
      outcome: response.toolResult?.tool === "authorization" ? "HELD" : "COMPLETED",
      approved_tool: response.toolResult?.tool ?? null,
      provider: response.provider,
      latency_ms: Date.now() - startedAt,
    });
    return NextResponse.json({ answer: response.answer, tool: response.toolResult?.tool ?? null, provider: response.provider, escalationSuggested, surface: requestedSurface });
  } catch (error) {
    if (auditContext) {
      await recordAiInteraction({
        ...auditContext,
        request_id: requestId,
        outcome: "FAILED",
        approved_tool: null,
        provider: configuredProvider,
        latency_ms: Date.now() - startedAt,
      });
    }
    const appError = error instanceof AppError ? error : new AppError("NETWORK_ERROR", "DAN T AI is temporarily unavailable.", 503, error);
    console.error("DAN T AI error:", error);
    return NextResponse.json({ error: appError.message }, { status: appError.status });
  }
}
