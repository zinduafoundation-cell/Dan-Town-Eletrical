"use client";

import { FormEvent, useState } from "react";
import { UserPlus } from "lucide-react";
import { userRoles } from "@dantown/shared";

const assignableRoles = userRoles.filter((role) => role !== "CUSTOMER" && role !== "CONTRACTOR");

export function TeamInviteForm({ canInvite, canAssignCEO }: { canInvite: boolean; canAssignCEO: boolean }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/team/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), fullName: form.get("fullName"), role: form.get("role") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send invitation.");
      setMessage(result.message || "Invitation sent.");
      event.currentTarget.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to send invitation."); }
    finally { setSaving(false); }
  }

  if (!canInvite) return <section className="team-access-note"><strong>Invitation access is restricted.</strong><p>Your account can view staff access but cannot invite or assign roles.</p></section>;

  return <section className="team-invite-panel"><div className="team-invite-heading"><span className="catalog-form-icon"><UserPlus size={19} /></span><div><p className="eyebrow">Add staff</p><h2>Invite a team member.</h2></div></div><p>Assign the least access needed. CEO access can only be assigned by an authenticated CEO account.</p>{message && <div className="catalog-manager-message" role="status">{message}</div>}<form className="team-invite-form" onSubmit={submit}><label>Full name<input name="fullName" required minLength={2} placeholder="Staff member name" /></label><label>Email<input name="email" type="email" required placeholder="staff@example.com" /></label><label>Role<select name="role" defaultValue="SALES_AGENT">{assignableRoles.filter((role) => role !== "CEO" || canAssignCEO).map((role) => <option value={role} key={role}>{role.replace(/_/g, " ")}</option>)}</select></label><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Sending..." : "Send invitation"}</button></form></section>;
}
