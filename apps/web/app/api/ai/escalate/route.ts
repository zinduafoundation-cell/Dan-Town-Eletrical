import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizationContext } from "@/lib/auth/server";
import { emit } from "@/lib/core/events";
import { dispatchAutomationEvent } from "@/lib/automation/dispatch";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const escalationSchema = z.object({
  sessionId: z.string().trim().max(120).optional(),
  category: z.string().trim().min(2).max(80).default("GENERAL_SUPPORT"),
  summary: z.string().trim().min(5).max(1000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL")
});

export async function POST(request: Request) {
  try {
    const parsed = escalationSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please describe what you need help with." }, { status: 400 });
    const context = await getAuthorizationContext();
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.from("ai_support_escalations").insert({ user_id: context?.userId === "dev-bypass-user" ? null : context?.userId ?? null, guest_session_id: parsed.data.sessionId ?? null, category: parsed.data.category, summary: parsed.data.summary, priority: parsed.data.priority, status: "OPEN", assigned_to: null }).select("id, status, created_at").single();
    if (error || !data) return NextResponse.json({ error: "Unable to create a support request right now." }, { status: 500 });
    const event = emit("AI_SUPPORT_ESCALATED", { escalationId: data.id, userId: context?.userId === "dev-bypass-user" ? null : context?.userId ?? null, category: parsed.data.category, summary: parsed.data.summary, occurredAt: new Date().toISOString() });
    dispatchAutomationEvent({ workflowName: "DANTOWN_AI_SUPPORT_ESCALATION", source: "DAN_T_AI", sourceReference: data.id, payload: event.payload }).catch((dispatchError) => console.error("AI escalation automation dispatch failed", dispatchError));
    return NextResponse.json({ escalationId: data.id, status: data.status, createdAt: data.created_at });
  } catch (error) {
    console.error("AI escalation failed", error);
    return NextResponse.json({ error: "Unable to create a support request right now." }, { status: 500 });
  }
}