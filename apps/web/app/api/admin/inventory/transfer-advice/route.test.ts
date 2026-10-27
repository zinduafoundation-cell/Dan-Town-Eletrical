import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
  getPermissionGuard: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getPermissionGuard: mocks.getPermissionGuard,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
}));

import { POST } from "./route";

function createQuery(result: { data: unknown; error: null }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn(),
    then: (resolve: (value: { data: unknown; error: null }) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  for (const method of [query.select, query.eq, query.in, query.is, query.maybeSingle]) method.mockReturnValue(query);
  return query;
}

function setupService() {
  const queries = {
    products: createQuery({
      data: { id: "33333333-3333-4333-8333-333333333333", name: "LED lamp" },
      error: null,
    }),
    warehouses: createQuery({
      data: [
        { id: "44444444-4444-4444-8444-444444444444", name: "Dan 1" },
        { id: "55555555-5555-4555-8555-555555555555", name: "Store 3" },
      ],
      error: null,
    }),
    inventory: createQuery({
      data: [
        { product_id: "33333333-3333-4333-8333-333333333333", warehouse_id: "44444444-4444-4444-8444-444444444444", quantity: 2, reserved_quantity: 1 },
        { product_id: "33333333-3333-4333-8333-333333333333", warehouse_id: "55555555-5555-4555-8555-555555555555", quantity: 8, reserved_quantity: 0 },
      ],
      error: null,
    }),
  };
  const service = { from: vi.fn((table: keyof typeof queries) => queries[table]) };
  mocks.createSupabaseServiceClient.mockReturnValue(service);
  return { queries, service };
}

function request(body: unknown) {
  return new Request("https://shop.example/api/admin/inventory/transfer-advice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validRequest = {
  productId: "33333333-3333-4333-8333-333333333333",
  quantity: 5,
  destinationWarehouseId: "44444444-4444-4444-8444-444444444444",
};

describe("inventory transfer advice API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPermissionGuard.mockResolvedValue({ ok: true, status: 200, message: "Authorized" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("requires the existing inventory adjustment permission", async () => {
    mocks.getPermissionGuard.mockResolvedValue({ ok: false, status: 403, message: "Not authorized" });

    const response = await POST(request(validRequest));

    expect(response.status).toBe(403);
    expect(mocks.getPermissionGuard).toHaveBeenCalledWith("inventory.adjust");
    expect(mocks.createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("validates the transfer request and requires configured Python service credentials", async () => {
    const invalid = await POST(request({ ...validRequest, quantity: 0 }));
    expect(invalid.status).toBe(400);

    vi.stubEnv("PYTHON_AUTOMATION_URL", "");
    vi.stubEnv("PYTHON_AUTOMATION_SECRET", "");
    const unconfigured = await POST(request(validRequest));
    expect(unconfigured.status).toBe(503);
    expect(mocks.createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("sends a signed snapshot with active warehouse stock and never changes stock", async () => {
    const { queries } = setupService();
    vi.stubEnv("PYTHON_AUTOMATION_URL", "http://127.0.0.1:8010");
    vi.stubEnv("PYTHON_AUTOMATION_SECRET", "test-secret-with-more-than-32-characters");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        recommendations: [{
          product_id: validRequest.productId,
          product_name: "LED lamp",
          quantity: 5,
          status: "transfer_suggested",
          available_quantity: 9,
          source_warehouse: { id: validRequest.destinationWarehouseId, name: "Dan 1" },
          transfers: [{
            source_warehouse: { id: "55555555-5555-4555-8555-555555555555", name: "Store 3" },
            destination_warehouse: { id: validRequest.destinationWarehouseId, name: "Dan 1" },
            quantity: 4,
          }],
          staff_confirmation_required: true,
        }],
        stock_mutated: false,
      }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request(validRequest));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ stock_mutated: false });
    expect(queries.inventory.in).toHaveBeenCalledWith(
      "warehouse_id",
      [validRequest.destinationWarehouseId, "55555555-5555-4555-8555-555555555555"],
    );
    expect(queries.inventory.is).toHaveBeenCalledWith("variant_id", null);
    expect(queries.inventory.is).toHaveBeenCalledWith("location_id", null);
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("http://127.0.0.1:8010/inventory/recommendations");
    const payload = JSON.parse(String(options.body)) as {
      inventory: Array<{ warehouse_name: string; quantity: number; reserved_quantity: number }>;
      preferred_warehouse_id: string;
    };
    expect(payload.inventory).toHaveLength(2);
    expect(payload.inventory[0]).toMatchObject({ warehouse_name: "Dan 1", quantity: 2, reserved_quantity: 1 });
    expect(payload.preferred_warehouse_id).toBe(validRequest.destinationWarehouseId);
    const headers = new Headers(options.headers);
    expect(headers.get("X-Dantown-Signature")).toBe(
      createHmac("sha256", "test-secret-with-more-than-32-characters")
        .update(`${headers.get("X-Dantown-Timestamp")}.${String(options.body)}`)
        .digest("hex"),
    );
  });
});
