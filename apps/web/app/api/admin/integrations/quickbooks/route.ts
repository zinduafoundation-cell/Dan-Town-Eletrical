import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { ok: false, message: "QuickBooks integration is not configured for this deployment." },
    { status: 501 }
  );
}

export async function POST() {
  return NextResponse.json(
    { ok: false, message: "QuickBooks integration is not configured for this deployment." },
    { status: 501 }
  );
}
