import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@dantown/database";
import { getCatalogProducts } from "@dantown/database";

function failingQuery() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    then: (_resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.reject(new Error("database unavailable")).then(undefined, reject),
  };
  for (const method of [query.select, query.eq, query.order, query.range]) {
    method.mockReturnValue(query);
  }
  return query;
}

function failingClient() {
  const query = failingQuery();
  return {
    from: vi.fn(() => query),
  } as unknown as SupabaseClient<Database>;
}

afterEach(() => vi.unstubAllEnvs());

describe("catalog outage behavior", () => {
  it("does not show demo products during a production database outage", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(getCatalogProducts(failingClient(), { allowFallback: true })).resolves.toEqual([]);

    expect(errorLog).toHaveBeenCalledOnce();
    errorLog.mockRestore();
  });

  it("keeps the existing sample catalogue fallback available in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const products = await getCatalogProducts(failingClient(), { allowFallback: true });

    expect(products.length).toBeGreaterThan(0);
    expect(products.every((product) => product.sku.startsWith("DEMO-"))).toBe(true);
  });
});
