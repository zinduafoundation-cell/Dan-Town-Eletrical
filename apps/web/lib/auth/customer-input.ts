import type { User } from "@supabase/supabase-js";

export type ProvisioningUser = Pick<User, "id" | "email" | "phone" | "user_metadata">;

function metadataText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

/**
 * Converts authenticated-user details into customer data. Metadata is used only
 * for display information; roles and permissions are always assigned server-side.
 */
export function buildCustomerProvisioningInput(user: ProvisioningUser) {
  const metadata = user.user_metadata ?? {};
  const email = metadataText(user.email, 254).toLowerCase() || null;
  const fullName =
    metadataText(metadata.full_name, 120) ||
    metadataText(metadata.name, 120) ||
    (email ? email.split("@")[0] : "Dantown Customer");
  const phone = metadataText(metadata.phone, 30) || metadataText(user.phone, 30) || null;

  return {
    user_id: user.id,
    name: fullName,
    email,
    phone,
    customer_type: "RETAIL" as const,
    status: "ACTIVE" as const,
  };
}
