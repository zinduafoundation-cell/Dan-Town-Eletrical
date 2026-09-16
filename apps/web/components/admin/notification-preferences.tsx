"use client";

import { useEffect, useState } from "react";

type Preferences = { email: boolean; sms: boolean; whatsapp: boolean; push: boolean };
const defaults: Preferences = { email: true, sms: false, whatsapp: false, push: false };

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [status, setStatus] = useState("Loading preferences...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/notifications", { cache: "no-store" }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load preferences.");
      setPreferences(result.preferences);
      setStatus(result.persisted ? "Saved preferences" : "Development mode: changes are not persisted");
    }).catch((error) => setStatus(error instanceof Error ? error.message : "Unable to load preferences."));
  }, []);

  async function save() {
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/settings/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preferences) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save preferences.");
      setStatus(result.persisted ? "Notification preferences saved" : "Development mode: changes are not persisted");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to save preferences."); }
    finally { setSaving(false); }
  }

  return <section className="settings-preferences"><div><p className="eyebrow">Your notification preferences</p><h2>Choose how operational updates reach you.</h2><p>These settings apply to your signed-in account only. Provider availability and delivery remain controlled by the configured integrations.</p></div><div className="settings-preference-list">{(["email", "sms", "whatsapp", "push"] as const).map((channel) => <label key={channel}><span><strong>{channel === "whatsapp" ? "WhatsApp" : channel === "sms" ? "SMS" : channel[0].toUpperCase() + channel.slice(1)}</strong><small>Receive relevant Dantown alerts through {channel === "push" ? "supported device notifications" : channel}.</small></span><input type="checkbox" checked={preferences[channel]} onChange={(event) => setPreferences((current) => ({ ...current, [channel]: event.target.checked }))} /></label>)}</div><div className="settings-preference-footer"><span role="status">{status}</span><button type="button" className="button button-primary" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save preferences"}</button></div></section>;
}