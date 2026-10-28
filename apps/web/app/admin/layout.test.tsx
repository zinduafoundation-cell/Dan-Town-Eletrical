import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthorizationContext: vi.fn(),
  hasPermission: vi.fn(),
  isBskAccount: vi.fn(),
  isPinConfigured: vi.fn(),
  isQuickAccessEnabled: vi.fn(),
  redirect: vi.fn(),
  shouldBypassAuth: vi.fn(),
  userHasPasskey: vi.fn(),
}));

vi.mock("@dantown/auth", () => ({
  hasPermission: mocks.hasPermission,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth/server", () => ({
  getAuthorizationContext: mocks.getAuthorizationContext,
  isBskAccount: mocks.isBskAccount,
  shouldBypassAuth: mocks.shouldBypassAuth,
}));

vi.mock("@/lib/auth/quick-access", () => ({
  hasQuickAccess: vi.fn(),
  isPinConfigured: mocks.isPinConfigured,
  isQuickAccessEnabled: mocks.isQuickAccessEnabled,
}));

vi.mock("@/lib/auth/passkeys", () => ({
  userHasPasskey: mocks.userHasPasskey,
}));

import AdminLayout from "./layout";

describe("admin route authorization layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation((destination: string) => {
      throw new Error(`REDIRECT:${destination}`);
    });
    mocks.isQuickAccessEnabled.mockReturnValue(false);
    mocks.shouldBypassAuth.mockReturnValue(false);
  });

  it("redirects to login instead of rendering admin content without a verified user", async () => {
    mocks.getAuthorizationContext.mockResolvedValue(null);

    await expect(AdminLayout({ children: "sensitive admin content" })).rejects.toThrow("REDIRECT:/login");

    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("renders admin children for an authenticated user with Centre access", async () => {
    mocks.getAuthorizationContext.mockResolvedValue({
      userId: "staff-user",
      roles: ["INVENTORY_MANAGER"],
      permissions: ["inventory.read"],
    });
    mocks.hasPermission.mockReturnValue(true);

    await expect(AdminLayout({ children: "authorized admin content" })).resolves.toBe("authorized admin content");

    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
