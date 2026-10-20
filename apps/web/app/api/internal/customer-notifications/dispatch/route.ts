import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { dispatchCustomerNotificationBatch } from "@/lib/customer-notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !provided) return false;
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Customer notification worker is not configured." }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const result = await dispatchCustomerNotificationBatch();
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("CUSTOMER NOTIFICATION WORKER ERROR", error);
    return NextResponse.json({ error: "Customer notification delivery could not be completed." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Customer notification worker is not configured." }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid worker request." }, { status: 400 });
  }
  const parsed = z.object({ limit: z.number().int().min(1).max(100).default(50) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid worker request." }, { status: 400 });
  try {
    const result = await dispatchCustomerNotificationBatch(parsed.data.limit);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("CUSTOMER NOTIFICATION WORKER ERROR", error);
    return NextResponse.json({ error: "Customer notification delivery could not be completed." }, { status: 503 });
  }
}
