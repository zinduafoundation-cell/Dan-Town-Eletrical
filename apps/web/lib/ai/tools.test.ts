import { describe, expect, it } from "vitest";
import { searchSettingsCategories } from "../settings/categories";
import { classifyQuestion } from "./intent";
import { aiSurfaceFor, isSurfaceAllowed, isSurfaceIntentAllowed } from "./surface";

describe("DAN T AI approved tool routing", () => {
  it("routes public product and availability questions safely", () => {
    expect(classifyQuestion("Do you have a 2.5mm cable")).toBe("products");
    expect(classifyQuestion("Is the MCCB available")).toBe("inventory");
    expect(classifyQuestion("Which products need reorder")).toBe("inventory");
    expect(classifyQuestion("What categories do you sell")).toBe("categories");
  });

  it("routes private questions to distinct ownership-aware tools", () => {
    expect(classifyQuestion("Where is my order")).toBe("orders");
    expect(classifyQuestion("What is my quotation status")).toBe("quotes");
    expect(classifyQuestion("Find pending quotation DT-Q-2026-1001")).toBe("quotes");
    expect(classifyQuestion("Show today's sales")).toBe("sales");
    expect(classifyQuestion("Show my order payment status")).toBe("orders");
    expect(classifyQuestion("How much cash is in my cash drawer?")).toBe("payments");
    expect(classifyQuestion("What payment methods do you accept?")).toBe("business");
    expect(classifyQuestion("What is the refund policy?")).toBe("business");
    expect(classifyQuestion("Find invoice DT-INV-2026-0001")).toBe("documents");
    expect(classifyQuestion("Show overdue invoices")).toBe("documents");
    expect(classifyQuestion("Find unpaid orders")).toBe("orders");
    expect(classifyQuestion("Find customer Jane Doe")).toBe("customers");
    expect(classifyQuestion("Search suppliers called East Africa Power")).toBe("suppliers");
    expect(classifyQuestion("Show pending payments")).toBe("payments");
    expect(isSurfaceIntentAllowed("pos", "payments")).toBe(true);
    expect(isSurfaceIntentAllowed("storefront", "payments")).toBe(true);
    expect(isSurfaceIntentAllowed("centre", "orders")).toBe(true);
    expect(isSurfaceIntentAllowed("admin", "documents")).toBe(true);
    expect(isSurfaceIntentAllowed("storefront", "documents")).toBe(true);
    expect(isSurfaceIntentAllowed("centre", "quotes")).toBe(true);
    expect(isSurfaceIntentAllowed("admin", "customers")).toBe(true);
    expect(isSurfaceIntentAllowed("storefront", "customers")).toBe(false);
    expect(isSurfaceIntentAllowed("storefront", "orders")).toBe(true);
  });

  it("surfaces only settings navigation matches to the AI context tool", () => {
    expect(classifyQuestion("Help me configure inventory settings")).toBe("settings");
    expect(searchSettingsCategories("Help me configure inventory settings").map((category) => category.slug)).toContain("products-and-inventory");
    expect(searchSettingsCategories("Help me find the right Dantown settings page and explain what it controls.")).toHaveLength(13);
    expect(isSurfaceIntentAllowed("admin", "settings")).toBe(true);
    expect(isSurfaceIntentAllowed("storefront", "settings")).toBe(false);
  });

  it("enforces surface access and keeps admin and POS scopes distinct", () => {
    expect(aiSurfaceFor("/business-center")).toBe("centre");
    expect(aiSurfaceFor("/pos")).toBe("pos");
    expect(aiSurfaceFor("/admin")).toBe("admin");
    expect(isSurfaceAllowed("centre", { userId: "u", roles: ["ADMIN"], permissions: ["orders.read", "inventory.read"] })).toBe(true);
    expect(isSurfaceAllowed("pos", { userId: "u", roles: ["CUSTOMER"], permissions: [] })).toBe(false);
    expect(isSurfaceAllowed("admin", { userId: "u", roles: ["ADMIN"], permissions: ["users.read"] })).toBe(true);
  });
});
