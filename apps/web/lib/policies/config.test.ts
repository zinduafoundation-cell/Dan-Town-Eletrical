import { describe, expect, it } from "vitest";
import { getPolicy, getRelatedPolicies, policies, policyGroups } from "./config";

describe("policy configuration", () => {
  it("contains the requested fourteen unique policy routes", () => {
    expect(policies).toHaveLength(14);
    expect(new Set(policies.map((policy) => policy.slug)).size).toBe(14);
    for (const slug of [
      "returns-refunds",
      "warranty",
      "delivery",
      "payments",
      "cancellations",
      "privacy",
      "terms",
      "product-safety",
      "installation-services",
      "complaints",
      "pricing-quotations",
      "promotions",
      "cookies",
      "legal-notice"
    ]) {
      expect(getPolicy(slug)).toBeDefined();
    }
  });

  it("groups every policy and resolves every related link", () => {
    expect(policyGroups).toEqual([
      "Customer Purchases",
      "Payments & Delivery",
      "Privacy & Security",
      "Legal Information"
    ]);
    for (const policy of policies) {
      expect(policyGroups).toContain(policy.group);
      expect(getRelatedPolicies(policy).length).toBe(policy.related.length);
      expect(policy.sections.length).toBeGreaterThan(0);
      expect(policy.sections.every((section) => section.body.includes("DRAFT") || section.body.includes("draft"))).toBe(true);
    }
  });
});
