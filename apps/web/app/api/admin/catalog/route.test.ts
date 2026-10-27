import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
  getPermissionGuard: vi.fn(),
  requireAuthorizedPermission: vi.fn(),
}));

vi.mock("../../../../lib/auth/server", () => ({
  getPermissionGuard: mocks.getPermissionGuard,
  requireAuthorizedPermission: mocks.requireAuthorizedPermission,
}));

vi.mock("../../../../lib/supabase/server", () => ({
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
}));

import { POST } from "./route";

function createQuery(result: { data: unknown; error: null }) {
  const query = {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: (resolve: (value: typeof result) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  for (const method of [query.insert, query.update, query.select, query.eq]) method.mockReturnValue(query);
  query.single.mockResolvedValue(result);
  query.maybeSingle.mockResolvedValue(result);
  return query;
}

function setupService(activeWarehouses = [{ id: "44444444-4444-4444-8444-444444444444" }]) {
  const products = createQuery({
    data: { id: "33333333-3333-4333-8333-333333333333" },
    error: null,
  });
  const warehouses = createQuery({ data: activeWarehouses, error: null });
  const rpc = vi.fn().mockResolvedValue({
    data: { initialized: true, quantity: 50 },
    error: null,
  });
  const service = {
    from: vi.fn((table: string) => table === "warehouses" ? warehouses : products),
    rpc,
  };
  mocks.createSupabaseServiceClient.mockReturnValue(service);
  return { products, warehouses, rpc };
}

function productRequest(overrides: Record<string, unknown> = {}) {
  return new Request("https://shop.example/api/admin/catalog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "product",
      name: "LED lamp",
      sku: "LED-TEST",
      slug: "led-lamp",
      retailPrice: 500,
      warehouseId: "44444444-4444-4444-8444-444444444444",
      ...overrides,
    }),
  });
}

describe("catalog product initial stock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthorizedPermission.mockResolvedValue({
      userId: "22222222-2222-4222-8222-222222222222",
    });
    mocks.getPermissionGuard.mockResolvedValue({
      ok: true,
      status: 200,
      message: "Authorized",
    });
  });

  it("defaults new products to 50 units and records stock through the database operation", async () => {
    const { products, rpc } = setupService();

    const response = await POST(productRequest({
      warehouseId: undefined,
      status: "ACTIVE",
      isActive: true,
    }));

    expect(response.status).toBe(200);
    expect(products.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "DRAFT", is_active: false }),
    );
    expect(products.update).toHaveBeenCalledWith({
      status: "ACTIVE",
      is_active: true,
    });
    expect(rpc).toHaveBeenCalledWith("initialize_catalog_product_stock", {
      target_product_id: "33333333-3333-4333-8333-333333333333",
      target_warehouse_id: "44444444-4444-4444-8444-444444444444",
      target_quantity: 50,
      target_user_id: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("does not create a product without inventory-adjust permission", async () => {
    const { products, rpc } = setupService();
    mocks.getPermissionGuard.mockResolvedValue({
      ok: false,
      status: 403,
      message: "Not authorized",
    });

    const response = await POST(productRequest());

    expect(response.status).toBe(403);
    expect(products.insert).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects stock initialization when an active warehouse was not explicitly selected and is ambiguous", async () => {
    const { products, rpc } = setupService([
      { id: "44444444-4444-4444-8444-444444444444" },
      { id: "55555555-5555-4555-8555-555555555555" },
    ]);

    const response = await POST(productRequest({ warehouseId: undefined }));

    expect(response.status).toBe(400);
    expect(products.insert).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps a product in draft if initial stock could not be recorded", async () => {
    const { products, rpc } = setupService();
    rpc.mockResolvedValue({
      data: null,
      error: { message: "initializer unavailable" },
    });

    const response = await POST(productRequest({ status: "ACTIVE", isActive: true }));

    expect(response.status).toBe(500);
    expect(products.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "DRAFT", is_active: false }),
    );
    expect(products.update).not.toHaveBeenCalled();
  });
});
