import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { dispatchDomainEventBatch } from "@/lib/events/outbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({ limit: z.number().int().min(1).max(100).default(20) });

function matchesWorkerSecret(request: Request) {
  const expected = process.env.CRON_SECRET ?? process.env.DANTOWN_EVENT_WORKER_SECRET;
  const authorization = request.headers.get("authorization");
  const provided = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

async function dispatch(request: Request, limit: number) {
  if (!(process.env.CRON_SECRET ?? process.env.DANTOWN_EVENT_WORKER_SECRET)) {
    return NextResponse.json({ error: "Domain event worker is not configured." }, { status: 503 });
  }
  if (!matchesWorkerSecret(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = await dispatchDomainEventBatch(limit);
  if (!result.enabled) {
    return NextResponse.json({ error: "Domain event webhook delivery is not configured." }, { status: 503 });
  }
  return NextResponse.json({ data: result });
}

export async function GET(request: Request) {
  try {
    return await dispatch(request, 20);
  } catch (error) {
    console.error("Domain event dispatch failed", error);
    return NextResponse.json({ error: "Domain event dispatch failed." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid dispatch request." }, { status: 400 });
    return await dispatch(request, parsed.data.limit);
  } catch (error) {
    console.error("Domain event dispatch failed", error);
    return NextResponse.json({ error: "Domain event dispatch failed." }, { status: 503 });
  }
}
