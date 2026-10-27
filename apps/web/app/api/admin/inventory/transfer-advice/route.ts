import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPermissionGuard } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100_000),
  destinationWarehouseId: z.string().uuid(),
}).strict();

const warehouseSchema = z.object({ id: z.string(), name: z.string().nullable() });
const adviceSchema = z.object({
  recommendations: z.array(z.object({
    product_id: z.string(),
    product_name: z.string().nullable(),
    quantity: z.number().int().nonnegative(),
    status: z.enum(["ready", "transfer_suggested", "insufficient_stock"]),
    available_quantity: z.number().int().nonnegative(),
    source_warehouse: warehouseSchema.nullable(),
    transfers: z.array(z.object({
      source_warehouse: warehouseSchema,
      destination_warehouse: warehouseSchema,
      quantity: z.number().int().positive(),
    })),
    staff_confirmation_required: z.boolean(),
  })),
  stock_mutated: z.literal(false),
}).strict();

export async function POST(request: Request) {
  const guard = await getPermissionGuard("inventory.adjust");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Provide a valid product, quantity, and destination." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a valid product, quantity, and destination." }, { status: 400 });
  }

  const engineUrl = process.env.PYTHON_AUTOMATION_URL;
  const secret = process.env.PYTHON_AUTOMATION_SECRET;
  if (!engineUrl || !secret || secret.length < 32) {
    return NextResponse.json({ error: "The Python inventory advisor is not configured." }, { status: 503 });
  }

  let endpoint: URL;
  try {
    endpoint = new URL("/inventory/recommendations", engineUrl);
  } catch {
    return NextResponse.json({ error: "The Python inventory advisor URL is invalid." }, { status: 503 });
  }
  if (process.env.NODE_ENV === "production" && endpoint.protocol !== "https:") {
    return NextResponse.json({ error: "The Python inventory advisor must use HTTPS in production." }, { status: 503 });
  }

  try {
    const service = createSupabaseServiceClient();
    const [{ data: product, error: productError }, { data: warehouses, error: warehousesError }] = await Promise.all([
      service.from("products").select("id,name").eq("id", parsed.data.productId).maybeSingle(),
      service.from("warehouses").select("id,name").eq("is_active", true),
    ]);
    if (productError) throw productError;
    if (warehousesError) throw warehousesError;
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    if (!warehouses?.length) return NextResponse.json({ error: "No active warehouses are configured." }, { status: 409 });
    if (!warehouses.some((warehouse) => warehouse.id === parsed.data.destinationWarehouseId)) {
      return NextResponse.json({ error: "Choose an active destination warehouse." }, { status: 400 });
    }

    const { data: inventory, error: inventoryError } = await service
      .from("inventory")
      .select("product_id,warehouse_id,quantity,reserved_quantity,variant_id,location_id")
      .eq("product_id", parsed.data.productId)
      .in("warehouse_id", warehouses.map((warehouse) => warehouse.id))
      .is("variant_id", null)
      .is("location_id", null);
    if (inventoryError) throw inventoryError;

    const stockByWarehouse = new Map<string, { quantity: number; reserved: number }>();
    for (const row of inventory ?? []) {
      const current = stockByWarehouse.get(row.warehouse_id) ?? { quantity: 0, reserved: 0 };
      current.quantity += Number(row.quantity);
      current.reserved += Number(row.reserved_quantity);
      stockByWarehouse.set(row.warehouse_id, current);
    }

    const payload = JSON.stringify({
      items: [{
        product_id: product.id,
        product_name: product.name,
        quantity: parsed.data.quantity,
      }],
      inventory: warehouses.map((warehouse) => {
        const stock = stockByWarehouse.get(warehouse.id) ?? { quantity: 0, reserved: 0 };
        return {
          product_id: product.id,
          warehouse_id: warehouse.id,
          warehouse_name: warehouse.name,
          quantity: stock.quantity,
          reserved_quantity: stock.reserved,
        };
      }),
      preferred_warehouse_id: parsed.data.destinationWarehouseId,
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    const response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        "X-Dantown-Timestamp": timestamp,
        "X-Dantown-Signature": signature,
      },
      body: payload,
    });
    if (!response.ok) {
      console.error("Python inventory advisor returned HTTP", response.status);
      return NextResponse.json({ error: "The Python inventory advisor could not complete this request." }, { status: 502 });
    }

    const result = adviceSchema.safeParse(await response.json());
    if (!result.success) {
      console.error("Python inventory advisor returned an invalid response.");
      return NextResponse.json({ error: "The Python inventory advisor returned an invalid response." }, { status: 502 });
    }
    return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(
      "Inventory transfer advice failed:",
      error instanceof Error ? error.message : "Unknown service error",
    );
    return NextResponse.json({ error: "Unable to prepare transfer advice. Please try again." }, { status: 500 });
  }
}
