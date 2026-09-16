import { requireAuthorizedPermission } from "../../../lib/auth/server";
import { createSupabaseServiceClient } from "../../../lib/supabase/server";
import { hasPermission, hasRole } from "@dantown/auth";
import { TeamInviteForm } from "@/components/admin/team-invite-form";
import { PortalShell } from "../../portal-shell";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
	const context = await requireAuthorizedPermission("users.read");
	const supabase = createSupabaseServiceClient();
	const [{ data: assignments }, { data: roles }, { data: profiles }] = await Promise.all([
		supabase.from("user_roles").select("user_id,role_id,assigned_by"),
		supabase.from("roles").select("id,code,name"),
		supabase.from("profiles").select("id,full_name,status").order("full_name")
	]);
	const roleMap = new Map((roles ?? []).map((role) => [role.id, role]));
	const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
	const staff = (assignments ?? []).map((assignment) => ({ ...assignment, role: roleMap.get(assignment.role_id), profile: profileMap.get(assignment.user_id) })).filter((member) => member.profile || member.role);
	const canInvite = hasPermission(context, "users.create");

	return <PortalShell title="The right people, clearly." description="Invite staff and manage access through explicit roles and permissions." roles={context.roles} permissions={context.permissions} links={[{ label: "Overview", href: "/admin" }, { label: "Team", href: "/admin/team" }, { label: "Roles", href: "/admin/team", permission: "roles.read" }, { label: "Audit logs", href: "/admin/audit-logs", permission: "audit_logs.read" }]}>
		<div className="portal-grid"><article className="portal-card"><small>Staff accounts</small><strong>{staff.length || "No"} assigned</strong></article><article className="portal-card"><small>Role safety</small><strong>CEO protected</strong></article><article className="portal-card"><small>Audit trail</small><strong>Every change recorded</strong></article></div>
		<TeamInviteForm canInvite={canInvite} canAssignCEO={hasRole(context, "CEO")} />
		<section className="team-list-panel"><div className="section-heading"><div><p className="eyebrow">Current access</p><h2>Staff and roles</h2></div><span>{staff.length} assignments</span></div>{staff.length ? <div className="team-list">{staff.map((member) => <article className="team-row" key={`${member.user_id}-${member.role_id}`}><div><strong>{member.profile?.full_name || "Invited user"}</strong><small>{member.user_id}</small></div><div><span className="team-role-badge">{member.role?.name || member.role?.code || "Unassigned"}</span><small>{member.profile?.status || "Pending profile"}</small></div></article>)}</div> : <div className="empty-state"><h3>No staff role assignments found.</h3><p>Invite an authorized team member to begin.</p></div>}</section>
	</PortalShell>;
}
