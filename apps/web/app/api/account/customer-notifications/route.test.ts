import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getAuthenticatedUserId: mocks.getAuthenticatedUserId,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import { GET, PATCH } from "./route";

type QueryResult = { data?: unknown; count?: number; error: null };

function createQuery(result: QueryResult) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    is: vi.fn(),
    not: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
    then: (resolve: (value: QueryResult) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  for (const method of [query.select, query.eq, query.order, query.range, query.is, query.not, query.maybeSingle, query.update]) {
    method.mockReturnValue(query);
  }
  return query;
}

function setup(userId: string | null) {
  const queries: ReturnType<typeof createQuery>[] = [];
  let notificationQueryCount = 0;
  const client = {
    from: vi.fn((table: string) => {
      const result =
        table === "customer_notification_preferences"
          ? { data: { inbox_enabled: true }, error: null }
          : notificationQueryCount++ === 0
            ? { data: [], error: null }
            : { count: 2, error: null };
      const query = createQuery(result);
      queries.push(query);
      return query;
    }),
  };
  mocks.getAuthenticatedUserId.mockResolvedValue(userId);
  mocks.createSupabaseServerClient.mockResolvedValue(client);
  return { client, queries };
}

describe("customer notification API authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["missing", "expired or invalid"])("returns 401 for a %s session", async () => {
    const { client } = setup(null);
    const response = await GET(new Request("https://shop.example/api/account/customer-notifications"));

    expect(response.status).toBe(401);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("filters both notification reads by the verified owner", async () => {
    const { queries } = setup("customer-a");
    const response = await GET(new Request("https://shop.example/api/account/customer-notifications?limit=1"));

    expect(response.status).toBe(200);
    const notificationQueries = queries.slice(1);
    expect(notificationQueries).toHaveLength(2);
    for (const query of notificationQueries) {
      expect(query.eq).toHaveBeenCalledWith("user_id", "customer-a");
    }
  });

  it("keeps updates owner-scoped even when a foreign notification id is supplied", async () => {
    const { queries } = setup("customer-a");
    const response = await PATCH(
      new Request("https://shop.example/api/account/customer-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "9f6f7a15-060d-4c64-a873-f5b68f7dd881" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(queries[0].eq).toHaveBeenCalledWith("user_id", "customer-a");
    expect(queries[0].is).toHaveBeenCalledWith("read_at", null);
    expect(queries[0].eq).toHaveBeenCalledWith("id", "9f6f7a15-060d-4c64-a873-f5b68f7dd881");
  });
});
