import { describe, expect, it } from "vitest";
import { buildCustomerProvisioningInput } from "./customer-input";

describe("customer provisioning input", () => {
  it("uses verified identity data and metadata only for customer display fields", () => {
    const customer = buildCustomerProvisioningInput({
      id: "customer-user-id",
      email: "Customer@Example.com",
      phone: "+254700000000",
      user_metadata: { full_name: "  Ada Customer  ", phone: "  +254711111111  ", role: "ADMIN" },
    });

    expect(customer).toEqual({
      user_id: "customer-user-id",
      name: "Ada Customer",
      email: "customer@example.com",
      phone: "+254711111111",
      customer_type: "RETAIL",
      status: "ACTIVE",
    });
    expect(customer).not.toHaveProperty("role");
  });

  it("uses safe fallbacks when an OAuth profile does not provide a name or phone", () => {
    const customer = buildCustomerProvisioningInput({
      id: "oauth-user-id",
      email: "oauth.customer@example.com",
      phone: null,
      user_metadata: {},
    });

    expect(customer.name).toBe("oauth.customer");
    expect(customer.phone).toBeNull();
  });
});
