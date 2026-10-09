import { describe, expect, it } from "vitest";
import { isDatabaseBackedPath } from "./database-backed-routes";

describe("database-backed route refresh scope", () => {
  it.each([
    "/",
    "/account",
    "/account/orders",
    "/admin/orders",
    "/brands/brightlite",
    "/business-center",
    "/categories/solar",
    "/deals",
    "/electrical",
    "/pos/new-sale",
    "/products/circuit-breaker",
    "/search",
    "/shop",
    "/solar",
    "/staff/inventory",
  ])("refreshes server data for %s", (pathname) => {
    expect(isDatabaseBackedPath(pathname)).toBe(true);
  });

  it.each(["/about", "/administrator", "/services", "/solutions"])(
    "does not poll non-workspace route %s",
    (pathname) => {
      expect(isDatabaseBackedPath(pathname)).toBe(false);
    },
  );
});
