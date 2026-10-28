import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getAuthorizationContext: vi.fn(),
  hasPermission: vi.fn(),
  hasRole: vi.fn(),
  inviteUserByEmail: vi.fn(),
  isBskAccount: vi.fn(),
}));

vi.mock("../../../../../lib/auth/server", () => ({
  getAuthorizationContext: mocks.getAuthorizationContext,
  isBskAccount: mocks.isBskAccount,
}));

vi.mock("../../../../../lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@dantown/auth", () => ({
  hasPermission: mocks.hasPermission,
  hasRole: mocks.hasRole,
}));

import { POST } from "./route";

function createQuery(result: { data: unknown; error: { code?: string } | null }) {
  const query = {
    eq: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
    upsert: vi.fn(),
    then: (resolve: (value: typeof result) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  for (const method of [query.eq, query.insert, query.select, query.upsert]) method.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);
  return query;
}

function setupService({
  role = { id: "role-sales-agent" },
  roleLookupError = null,
  assignmentError = null,
  auditError = null,
}: {
  role?: { id: string } | null;
  roleLookupError?: { code?: string } | null;
  assignmentError?: { code?: string } | null;
  auditError?: { code?: string } | null;
} = {}) {
  const roles = createQuery({ data: role, error: roleLookupError });
  const userRoles = createQuery({ data: null, error: assignmentError });
  const auditLogs = createQuery({ data: null, error: auditError });
  const client = {
    auth: { admin: { inviteUserByEmail: mocks.inviteUserByEmail } },
    from: vi.fn((table: string) => {
      if (table === "roles") return roles;
      if (table === "user_roles") return userRoles;
      return auditLogs;
    }),
  };
  mocks.createSupabaseAdminClient.mockReturnValue(client);
  mocks.inviteUserByEmail.mockResolvedValue({
    data: { user: { id: "invited-user-id" } },
    error: null,
  });
  return { auditLogs, client, roles, userRoles };
}

function request(body: string | Record<string, unknown> = {
  email: "staff@example.com",
  fullName: "Staff Member",
  role: "SALES_AGENT",
}) {
  return new Request("https://shop.example/api/admin/team/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("staff invitation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthorizationContext.mockResolvedValue({
      userId: "ceo-user-id",
      roles: ["CEO"],
      permissions: ["users.create"],
    });
    mocks.isBskAccount.mockResolvedValue(true);
    mocks.hasPermission.mockReturnValue(true);
    mocks.hasRole.mockReturnValue(true);
  });

  it("rejects unauthenticated callers before creating an admin client", async () => {
    mocks.getAuthorizationContext.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("restricts staff invitations to the protected BSK account", async () => {
    mocks.isBskAccount.mockResolvedValue(false);

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("requires the users.create permission", async () => {
    mocks.hasPermission.mockReturnValue(false);

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns a validation error for malformed JSON", async () => {
    const response = await POST(request("{"));

    expect(response.status).toBe(400);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("checks the configured role before sending an invitation", async () => {
    const { roles } = setupService({ role: null });

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(roles.maybeSingle).toHaveBeenCalled();
    expect(mocks.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("prevents non-CEOs from assigning the CEO role", async () => {
    mocks.hasRole.mockReturnValue(false);

    const response = await POST(request({
      email: "staff@example.com",
      fullName: "Staff Member",
      role: "CEO",
    }));

    expect(response.status).toBe(403);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("assigns the role idempotently and records a successful invitation", async () => {
    const { auditLogs, roles, userRoles } = setupService();

    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(roles.maybeSingle).toHaveBeenCalled();
    expect(mocks.inviteUserByEmail).toHaveBeenCalledWith("staff@example.com", {
      data: { full_name: "Staff Member" },
    });
    expect(userRoles.upsert).toHaveBeenCalledWith(
      { user_id: "invited-user-id", role_id: "role-sales-agent", assigned_by: "ceo-user-id" },
      { onConflict: "user_id,role_id", ignoreDuplicates: true },
    );
    expect(auditLogs.insert).toHaveBeenCalledWith(expect.objectContaining({
      action: "STAFF_INVITED",
      resource_id: "invited-user-id",
      new_data: { role: "SALES_AGENT" },
    }));
  });

  it("warns staff not to retry when post-invitation role assignment fails", async () => {
    setupService({ assignmentError: { code: "XX000" } });

    const response = await POST(request());
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result.error).toContain("Do not retry");
  });

  it("reports audit failures rather than claiming the invitation completed cleanly", async () => {
    setupService({ auditError: { code: "XX000" } });

    const response = await POST(request());
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result.error).toContain("audit record could not be saved");
    expect(result.error).toContain("Do not retry");
  });
});
