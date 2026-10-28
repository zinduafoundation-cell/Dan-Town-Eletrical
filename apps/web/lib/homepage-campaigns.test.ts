import { beforeEach, describe, expect, it, vi } from "vitest";
import type { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getHomepageCampaigns } from "./homepage-campaigns";

function createQuery(result: { data: unknown[] | null; error: { code: string; message: string } | null }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (value: typeof result) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  for (const method of [query.select, query.eq, query.or, query.order, query.limit]) {
    method.mockReturnValue(query);
  }
  return query;
}

function createClient(results: ReturnType<typeof createQuery>[]) {
  return {
    from: vi.fn(() => {
      const query = results.shift();
      if (!query) throw new Error("Unexpected campaign query");
      return query;
    }),
  } as unknown as ReturnType<typeof createSupabaseServiceClient>;
}

describe("homepage campaign loading", () => {
  beforeEach(() => vi.restoreAllMocks());

  it.each(["42703", "PGRST204"])(
    "uses desktop campaign images if the optional mobile-image migration is not deployed (%s)",
    async (databaseCode) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const campaigns = [{
        id: "campaign-1",
        title: "Solar offer",
        description: "Save on solar",
        badge: "Offer",
        image_url: "/solar.jpg",
        cta_label: "",
        destination_url: "/deals",
      }];
      const client = createClient([
        createQuery({ data: null, error: { code: databaseCode, message: "column mobile_image_url does not exist" } }),
        createQuery({ data: campaigns, error: null }),
      ]);

      await expect(getHomepageCampaigns(client)).resolves.toEqual([{
        ...campaigns[0],
        mobile_image_url: "/solar.jpg",
        cta_label: "Shop now",
      }]);
      expect(client.from).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledOnce();
    },
  );

  it("does not retry unrelated database failures", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = createClient([
      createQuery({ data: null, error: { code: "42501", message: "permission denied" } }),
    ]);

    await expect(getHomepageCampaigns(client)).resolves.toEqual([]);
    expect(client.from).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });
});
