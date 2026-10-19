import { NextResponse } from "next/server";
import { z } from "zod";
import { getPermissionGuard, getStaffIdentity } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const sessionColumns = "id,employee_id,warehouse_id,status,opening_balance,closing_balance,opened_at,closed_at,opening_notes,closing_notes";

const cashSessionActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("open"),
    openingFloat: z.number().finite().min(0).max(1_000_000_000),
    notes: z.string().trim().max(500).default("")
  }),
  z.object({
    action: z.literal("close"),
    sessionId: z.string().uuid(),
    countedCash: z.number().finite().min(0).max(1_000_000_000),
    notes: z.string().trim().max(500).default("")
  })
]);

async function getSessionState(employeeId: string) {
  const supabase = createSupabaseServiceClient();
  const { data: sessions, error: sessionsError } = await supabase
    .from("pos_sessions")
    .select(sessionColumns)
    .eq("employee_id", employeeId)
    .order("opened_at", { ascending: false })
    .limit(25);
  if (sessionsError) throw sessionsError;

  const openSessions = (sessions ?? []).filter((session) => session.status === "OPEN");
  const multipleOpenSessions = openSessions.length > 1;
  const session = openSessions[0] ?? sessions?.[0] ?? null;
  const [{ data: sessionWarehouse, error: sessionWarehouseError }, { data: activeWarehouse, error: activeWarehouseError }] = await Promise.all([
    session
      ? supabase.from("warehouses").select("id,name").eq("id", session.warehouse_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    !session || session.status === "CLOSED"
      ? supabase.from("warehouses").select("id,name").eq("is_active", true).order("name").limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);
  if (sessionWarehouseError) throw sessionWarehouseError;
  if (activeWarehouseError) throw activeWarehouseError;
  if (!session) {
    return {
      session: null,
      defaultWarehouse: activeWarehouse ? { id: activeWarehouse.id, name: activeWarehouse.name } : null,
      multipleOpenSessions
    };
  }

  const { data: movements, error: movementsError } = await supabase
    .from("cash_movements")
    .select("movement_type,amount")
    .eq("session_id", session.id);
  if (movementsError) throw movementsError;

  const totals = (movements ?? []).reduce((result, movement) => {
    const amount = Number(movement.amount);
    switch (movement.movement_type) {
      case "OPENING":
        break;
      case "SALE":
      case "PAID_IN":
        result.expectedCash += amount;
        if (movement.movement_type === "SALE") result.cashSales += amount;
        break;
      case "REFUND":
      case "PAID_OUT":
        result.expectedCash -= amount;
        break;
      case "CLOSING":
        break;
    }
    return result;
  }, { expectedCash: Number(session.opening_balance), cashSales: 0 });

  return {
    session: {
      id: session.id,
      status: session.status === "OPEN" ? "open" as const : "closed" as const,
      openingFloat: Number(session.opening_balance),
      cashSales: Number(totals.cashSales.toFixed(2)),
      countedCash: session.status === "CLOSED" ? Number(session.closing_balance ?? 0) : null,
      expectedCash: Number(totals.expectedCash.toFixed(2)),
      notes: session.status === "OPEN" ? session.opening_notes : session.closing_notes || session.opening_notes,
      startedAt: session.opened_at,
      closedAt: session.closed_at,
      warehouseId: session.warehouse_id,
      warehouseName: sessionWarehouse?.name ?? "Unavailable warehouse"
    },
    defaultWarehouse: activeWarehouse ? { id: activeWarehouse.id, name: activeWarehouse.name } : null,
    multipleOpenSessions
  };
}

export async function GET() {
  try {
    const guard = await getPermissionGuard("orders.create");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
    const staff = await getStaffIdentity(guard.context);
    if (!staff.userId) {
      return NextResponse.json({ error: "Sign in as a staff member to use persistent cash sessions." }, { status: 403 });
    }

    const state = await getSessionState(staff.userId);
    return NextResponse.json({
      session: state.session,
      defaultWarehouse: state.defaultWarehouse,
      multipleOpenSessions: state.multipleOpenSessions
    });
  } catch (error) {
    console.error("POS cash session lookup failed:", error);
    return NextResponse.json({ error: "Unable to load the POS cash session." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const guard = await getPermissionGuard("orders.create");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
    const staff = await getStaffIdentity(guard.context);
    if (!staff.userId) {
      return NextResponse.json({ error: "Sign in as a staff member to use persistent cash sessions." }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "A valid cash session request is required." }, { status: 400 });
    }
    const parsed = cashSessionActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Review the cash session amounts and notes." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    let rpcError: string | null = null;
    let errorStatus = 400;

    if (parsed.data.action === "open") {
      const { data: warehouse, error: warehouseError } = await supabase
        .from("warehouses")
        .select("id")
        .eq("is_active", true)
        .order("name")
        .limit(1)
        .maybeSingle();
      if (warehouseError) throw warehouseError;
      if (!warehouse) {
        return NextResponse.json({ error: "Create or activate a warehouse before opening a cash session." }, { status: 409 });
      }
      const { error } = await supabase.rpc("open_pos_cash_session", {
        target_employee_id: staff.userId,
        target_warehouse_id: warehouse.id,
        target_opening_balance: parsed.data.openingFloat,
        target_opening_notes: parsed.data.notes
      });
      if (error) {
        rpcError = error.message;
        errorStatus = error.message.includes("already exists") || error.message.includes("active warehouse") ? 409 : 500;
      }
    } else {
      const { error } = await supabase.rpc("close_pos_cash_session", {
        target_session_id: parsed.data.sessionId,
        target_employee_id: staff.userId,
        target_closing_balance: parsed.data.countedCash,
        target_closing_notes: parsed.data.notes
      });
      if (error) {
        rpcError = error.message;
        errorStatus = error.message.includes("already closed") ? 409
          : error.message.includes("not found") ? 404 : 500;
      }
    }

    if (rpcError) {
      console.error("POS cash session update failed:", rpcError);
      if (errorStatus === 500) throw new Error("The cash session database operation failed.");
      return NextResponse.json({ error: rpcError }, { status: errorStatus });
    }

    const state = await getSessionState(staff.userId);
    return NextResponse.json({
      session: state.session,
      defaultWarehouse: state.defaultWarehouse,
      multipleOpenSessions: state.multipleOpenSessions
    });
  } catch (error) {
    console.error("POS cash session update request failed:", error);
    return NextResponse.json({ error: "Unable to update the POS cash session." }, { status: 500 });
  }
}
