import { describe, expect, it } from "vitest";
import { buildCustomerProfileSummary } from "./customer-profile";

describe("buildCustomerProfileSummary", () => {
  it("returns a complete customer snapshot with tax details and counts", () => {
    const summary = buildCustomerProfileSummary({
      name: "Jane Njeri",
      customer_type: "BUSINESS",
      email: "jane@example.com",
      phone: "+254712345678",
      tax_number: "P051234567A",
      notes: "Prefers project quotations",
      status: "ACTIVE"
    }, {
      addressCount: 3,
      orderCount: 12,
      quoteCount: 4
    });

    expect(summary.taxLabel).toBe("P051234567A");
    expect(summary.overview).toContain("Business customer");
    expect(summary.overview).toContain("12 purchases");
    expect(summary.overview).toContain("3 saved delivery addresses");
  });

  it("falls back gracefully when tax details and counts are missing", () => {
    const summary = buildCustomerProfileSummary({
      name: "New customer",
      customer_type: null,
      email: null,
      phone: null,
      tax_number: null,
      notes: null,
      status: null
    }, {
      addressCount: 0,
      orderCount: 0,
      quoteCount: 0
    });

    expect(summary.taxLabel).toBe("Tax registration not added");
    expect(summary.overview).toContain("Retail customer");
    expect(summary.overview).toContain("No purchases yet");
  });
});
