import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
  getCatalogProducts: vi.fn(),
}));

vi.mock("@dantown/database", () => ({
  getCatalogProducts: mocks.getCatalogProducts,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
}));

import { GET } from "./route";

describe("catalog search endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServiceClient.mockReturnValue({ client: "service" });
    mocks.getCatalogProducts.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        id: `product-${index}`,
        name: `Tronic item ${index}`,
        slug: `tronic-item-${index}`,
        sku: `TR-${index}`,
        promotional_price: null,
        retail_price: index + 10,
        category: { name: "Electrical" },
      })),
    );
  });

  it("uses the featured catalogue query and requests only the eight displayed results", async () => {
    const response = await GET(new Request("https://shop.example/api/catalog/search?q=Tronic"));

    expect(response.status).toBe(200);
    expect(mocks.getCatalogProducts).toHaveBeenCalledWith(
      { client: "service" },
      { search: "Tronic", sort: "featured", pageSize: 8 },
    );
    expect((await response.json()).products).toHaveLength(8);
  });

  it("continues returning the safe product-card fields only", async () => {
    const response = await GET(new Request("https://shop.example/api/catalog/search?q=Tronic"));
    const result = await response.json();

    expect(result.products[0]).toEqual({
      id: "product-0",
      name: "Tronic item 0",
      slug: "tronic-item-0",
      sku: "TR-0",
      price: 10,
      category: "Electrical",
    });
  });

  it("does not turn punctuation-only terms into unfiltered catalogue queries", async () => {
    const response = await GET(new Request("https://shop.example/api/catalog/search?q=%%"));

    expect(response.status).toBe(200);
    expect((await response.json()).products).toEqual([]);
    expect(mocks.getCatalogProducts).not.toHaveBeenCalled();
  });
});
