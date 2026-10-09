import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { isCancelledOrderReadyForDeletion } from "@/lib/order-edit-window";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function matchesWorkerSecret(request: Request) {
  const expected = process.env.CRON_SECRET ?? process.env.DANTOWN_EVENT_WORKER_SECRET;
  const authorization = request.headers.get("authorization");
  const provided = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

async function cleanupCancelledOrders(request: Request) {
  if (!(process.env.CRON_SECRET ?? process.env.DANTOWN_EVENT_WORKER_SECRET)) {
    return NextResponse.json({ error: "Order cleanup worker is not configured." }, { status: 503 });
  }
  if (!matchesWorkerSecret(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const supabase = createSupabaseServiceClient();
  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: cancelledOrders, error } = await supabase
    .from("orders")
    .select("id, order_status, order_number, updated_at, created_at")
    .eq("order_status", "CANCELLED")
    .lt("updated_at", cutoff);

  if (error) {
    console.error("Cancelled order cleanup query failed", error);
    return NextResponse.json({ error: "Unable to clean up cancelled orders." }, { status: 500 });
  }

  const readyToDelete = (cancelledOrders ?? []).filter((order) =>
    isCancelledOrderReadyForDeletion(order.order_status, order.updated_at ?? order.created_at)
  );

  let deleted = 0;
  let failed = 0;

  for (const order of readyToDelete) {
    const { error: archiveError } = await supabase.rpc("archive_and_delete_order", {
      p_order_id: order.id,
      p_actor_user_id: null,
      p_action: "ORDER_AUTO_DELETED",
      p_metadata: {
        reason: "cancelled_order_cleanup_after_6_hours",
        deleted_by_role: "system",
        deleted_at: new Date().toISOString(),
        cancelled_at: order.updated_at ?? order.created_at
      }
    });
    if (archiveError) {
      failed += 1;
      console.error(`Cancelled order archive and deletion failed for ${order.id}`, archiveError);
    } else {
      deleted += 1;
    }
  }

  return NextResponse.json({
    success: true,
    deleted,
    failed,
    total: readyToDelete.length,
    cutoff
  });
}

export async function GET(request: Request) {
  try {
    return await cleanupCancelledOrders(request);
  } catch (error) {
    console.error("Cancelled order cleanup failed", error);
    return NextResponse.json({ error: "Cancelled order cleanup failed." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    return await cleanupCancelledOrders(request);
  } catch (error) {
    console.error("Cancelled order cleanup failed", error);
    return NextResponse.json({ error: "Cancelled order cleanup failed." }, { status: 503 });
  }
}
