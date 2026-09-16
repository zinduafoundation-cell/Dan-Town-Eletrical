import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizationContext } from "@/lib/auth/server";
import { completeWithProvider } from "@/lib/ai/provider";
import { runApprovedTool } from "@/lib/ai/tools";
import { isSurfaceAllowed, type AiSurface } from "@/lib/ai/surface";
import { AppError } from "@/lib/core/errors";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  surface: z.enum(["storefront", "centre", "pos", "admin"]).default("storefront"),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(3000) })).max(12).default([])
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please send a valid question." }, { status: 400 });

    const context = await getAuthorizationContext();
    const requestedSurface = parsed.data.surface as AiSurface;
    if (!isSurfaceAllowed(requestedSurface, context)) {
      return NextResponse.json({ error: "You are not authorized to use this Dantown AI surface." }, { status: 403 });
    }

    const toolResult = await runApprovedTool(parsed.data.message, context, requestedSurface);
    const escalationSuggested = /\b(human|agent|representative|complaint|complain|refund|charged|payment failed|speak to)\b/i.test(parsed.data.message) || (Array.isArray(toolResult.data) && toolResult.data.length === 0);
    const answer = await completeWithProvider([
      { role: "system", content: `You are DAN T AI ${requestedSurface === "storefront" ? "customer assistant" : requestedSurface === "centre" ? "business assistant" : requestedSurface === "pos" ? "POS assistant" : "admin intelligence"}. Answer only from the approved data context for the ${requestedSurface} surface. Never invent prices, stock, order status, payment confirmation, delivery promises, or policies. If data is missing, say that it cannot be confirmed. Make it concise and clearly label any recommendation as an AI recommendation or AI insight when the answer is advisory rather than a confirmed database fact. Do not mention internal tools or secrets.` },
      ...parsed.data.history,
      { role: "user", content: `Surface: ${requestedSurface}\nQuestion: ${parsed.data.message}\nApproved data from ${toolResult.tool}: ${JSON.stringify(toolResult.data)}` }
    ]);
    return NextResponse.json({ answer, tool: toolResult.tool, escalationSuggested, surface: requestedSurface });
  } catch (error) {
    const appError = error instanceof AppError ? error : new AppError("NETWORK_ERROR", "DAN T AI is temporarily unavailable.", 503, error);
    console.error("DAN T AI error:", error);
    return NextResponse.json({ error: appError.message }, { status: appError.status });
  }
}