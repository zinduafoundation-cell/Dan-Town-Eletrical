import { NextResponse } from "next/server";
import { z } from "zod";
import { hasPermission, hasRole } from "@dantown/auth";
import { userRoles } from "@dantown/shared";
import { getAuthorizationContext, isBskAccount } from "../../../../../lib/auth/server";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

const inviteSchema = z.object({
  email: z.string().trim().email().max(254),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(userRoles.filter((role) => role !== "CUSTOMER" && role !== "CONTRACTOR") as [string, ...string[]]),
});

export async function POST(request: Request) {
  const context = await getAuthorizationContext();
  if (!context) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  if (!(await isBskAccount())) {
    return NextResponse.json({ error: "Only the BSK account can manage staff and admin access." }, { status: 403 });
  }
  if (!hasPermission(context, "users.create")) {
    return NextResponse.json({ error: "You don't have permission to perform this action." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please check the invitation details." }, { status: 400 });
  }

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the invitation details." }, { status: 400 });
  }
  if (parsed.data.role === "CEO" && !hasRole(context, "CEO")) {
    return NextResponse.json({ error: "Only the CEO can assign CEO access." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: role, error: roleLookupError } = await supabase
    .from("roles")
    .select("id")
    .eq("code", parsed.data.role)
    .maybeSingle();

  if (roleLookupError) {
    console.error("STAFF INVITATION ROLE LOOKUP FAILED", roleLookupError.code);
    return NextResponse.json({ error: "We could not verify that role." }, { status: 500 });
  }
  if (!role) {
    return NextResponse.json({ error: "That role is not configured." }, { status: 400 });
  }

  const { data, error: invitationError } = await supabase.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.fullName },
  });
  if (invitationError || !data.user) {
    return NextResponse.json({ error: "We could not send the invitation." }, { status: 400 });
  }

  const { error: assignmentError } = await supabase.from("user_roles").upsert(
    { user_id: data.user.id, role_id: role.id, assigned_by: context.userId },
    { onConflict: "user_id,role_id", ignoreDuplicates: true },
  );
  if (assignmentError) {
    console.error("STAFF INVITATION ROLE ASSIGNMENT FAILED", assignmentError.code);
    return NextResponse.json({
      error: "The invitation was sent, but its role could not be assigned. Do not retry; contact an administrator.",
    }, { status: 500 });
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    user_id: context.userId,
    action: "STAFF_INVITED",
    resource_type: "user",
    resource_id: data.user.id,
    new_data: { role: parsed.data.role },
  });
  if (auditError) {
    console.error("STAFF INVITATION AUDIT LOG FAILED", auditError.code);
    return NextResponse.json({
      error: "The invitation was sent, but its audit record could not be saved. Do not retry; contact an administrator.",
    }, { status: 500 });
  }

  return NextResponse.json({ message: "Invitation sent." }, { status: 201 });
}
