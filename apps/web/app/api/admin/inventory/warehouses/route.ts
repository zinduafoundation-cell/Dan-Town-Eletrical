import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthorizedPermission } from "../../../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

const warehouseSchema = z.object({ name: z.string().trim().min(2).max(120), code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/), location: z.string().trim().max(160).nullable().optional(), description: z.string().trim().max(500).nullable().optional() });

export async function POST(request: Request) {
  try {
    const context = await requireAuthorizedPermission("inventory.adjust");
    const parsed = warehouseSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Check the warehouse name, code, and location." }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("warehouses").insert({ name: parsed.data.name, code: parsed.data.code, location: parsed.data.location ?? null, description: parsed.data.description ?? null, is_active: true, manager_id: context.userId === "dev-bypass-user" ? null : context.userId }).select("id,name,code,location,description").single();
    if (error) return NextResponse.json({ error: error.code === "23505" ? "That warehouse code is already in use." : error.message }, { status: error.code === "23505" ? 409 : 400 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("WAREHOUSE CREATE ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create warehouse." }, { status: 500 });
  }
}