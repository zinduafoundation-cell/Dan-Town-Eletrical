import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizationContext } from "@/lib/auth/server";
import { executeCentreCommand } from "@/lib/centre/command";
import { isSurfaceAllowed } from "@/lib/ai/surface";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const commandSchema = z.object({
  command: z.string().trim().min(2).max(320),
});

export async function POST(request: Request) {
  try {
    const parsed = commandSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a command between 2 and 320 characters." },
        { status: 400 }
      );
    }

    const context = await getAuthorizationContext();
    if (!isSurfaceAllowed("centre", context) || !context) {
      return NextResponse.json(
        { error: "You are not authorized to use Dantown Centre commands." },
        { status: 403 }
      );
    }

    return NextResponse.json({ data: await executeCentreCommand(parsed.data.command, context) });
  } catch (error) {
    console.error("Dantown Centre command error", error);
    return NextResponse.json(
      { error: "Dantown Centre could not complete that command right now." },
      { status: 500 }
    );
  }
}
