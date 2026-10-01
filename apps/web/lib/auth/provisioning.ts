import "server-only";

import { createSupabaseAdminClient } from "../supabase/admin";
import { buildCustomerProvisioningInput, type ProvisioningUser } from "./customer-input";

export { buildCustomerProvisioningInput } from "./customer-input";

export class CustomerProvisioningError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "CustomerProvisioningError";
  }
}

async function getCustomerRoleId() {
  const adminClient = createSupabaseAdminClient();
  const { data: existingRole, error: lookupError } = await adminClient
    .from("roles")
    .select("id")
    .eq("code", "CUSTOMER")
    .maybeSingle();

  if (lookupError) {
    throw new CustomerProvisioningError("Could not look up the customer role.", lookupError);
  }
  if (existingRole) return existingRole.id;

  const { data: createdRole, error: createError } = await adminClient
    .from("roles")
    .insert({ code: "CUSTOMER", name: "Customer", description: "Customer account access" })
    .select("id")
    .single();

  if (!createError && createdRole) return createdRole.id;

  // Another request can create the role between our lookup and insert. Read it
  // again instead of failing a valid sign-in in that harmless race.
  if (createError?.code === "23505") {
    const { data: roleAfterConflict, error: retryError } = await adminClient
      .from("roles")
      .select("id")
      .eq("code", "CUSTOMER")
      .single();

    if (!retryError && roleAfterConflict) return roleAfterConflict.id;
    throw new CustomerProvisioningError("Could not read the customer role after it was created.", retryError);
  }

  throw new CustomerProvisioningError("Could not create the customer role.", createError);
}

/**
 * Ensures each Supabase user has the minimal Dantown customer record and
 * CUSTOMER role. It is safe to call after registration, confirmation, or sign-in.
 */
export async function ensureCustomerProvisioning(user: ProvisioningUser) {
  const adminClient = createSupabaseAdminClient();
  const customer = buildCustomerProvisioningInput(user);
  const roleId = await getCustomerRoleId();

  const { error: customerError } = await adminClient
    .from("customers")
    .upsert(customer, { onConflict: "user_id", ignoreDuplicates: true });

  if (customerError) {
    throw new CustomerProvisioningError("Could not create the customer record.", customerError);
  }

  const { error: assignmentError } = await adminClient
    .from("user_roles")
    .upsert({ user_id: user.id, role_id: roleId }, { onConflict: "user_id,role_id", ignoreDuplicates: true });

  if (assignmentError) {
    throw new CustomerProvisioningError("Could not assign the customer role.", assignmentError);
  }
}
