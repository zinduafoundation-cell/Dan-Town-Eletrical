"use client";

import { useEffect, useState } from "react";
import {
  defaultCustomerNotificationPreferences,
  type CustomerNotificationPreferences,
} from "@/lib/customer-notification-types";

type Device = {
  id: string;
  device_label: string;
  active: boolean;
  created_at: string;
  last_success_at: string | null;
};

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export function CustomerNotificationSettings() {
  const [preferences, setPreferences] = useState<CustomerNotificationPreferences>(defaultCustomerNotificationPreferences);
  const [saved, setSaved] = useState<CustomerNotificationPreferences>(defaultCustomerNotificationPreferences);
  const [devices, setDevices] = useState<Device[]>([]);
  const [pushAvailable, setPushAvailable] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [status, setStatus] = useState("Loading notification settings…");
  const [saving, setSaving] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/account/notification-preferences", { cache: "no-store" }),
      fetch("/api/account/push-subscriptions", { cache: "no-store" }),
    ]).then(async ([preferenceResponse, deviceResponse]) => {
      const [preferenceResult, deviceResult] = await Promise.all([
        preferenceResponse.json(),
        deviceResponse.json(),
      ]);
      if (!preferenceResponse.ok) throw new Error(preferenceResult.error || "Unable to load preferences.");
      if (deviceResponse.status !== 401 && !deviceResponse.ok) throw new Error(deviceResult.error || "Unable to load devices.");
      if (!active) return;
      setPreferences(preferenceResult.preferences);
      setSaved(preferenceResult.preferences);
      setPushAvailable(preferenceResult.pushAvailable);
      setEmailAvailable(preferenceResult.emailAvailable);
      setDevices(deviceResponse.ok ? deviceResult.devices : []);
      setStatus(preferenceResult.persisted ? "Your preferences are saved to this account." : "Development mode: changes are not persisted.");
      setPushPermission(
        typeof Notification === "undefined" || !("serviceWorker" in navigator)
          ? "unsupported"
          : Notification.permission,
      );
    }).catch((error: unknown) => {
      if (active) setStatus(error instanceof Error ? error.message : "Unable to load preferences.");
    });
    return () => { active = false; };
  }, []);

  function change<K extends keyof CustomerNotificationPreferences>(key: K, value: CustomerNotificationPreferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/account/notification-preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(preferences),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save preferences.");
      setPreferences(result.preferences);
      setSaved(result.preferences);
      setStatus("Your notification preferences are saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save preferences.");
    } finally {
      setSaving(false);
    }
  }

  async function enablePush() {
    setSaving(true);
    setStatus("");
    try {
      if (!pushAvailable) throw new Error("Browser push is not configured for this website.");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
        throw new Error("This browser does not support browser push. Your inbox remains available.");
      }
      let permission = Notification.permission;
      if (permission === "default") permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== "granted") {
        throw new Error(permission === "denied"
          ? "Browser notifications are blocked in your browser settings. Your inbox remains available."
          : "Browser notification permission was not granted.");
      }

      const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      const publicKeyResponse = await fetch("/api/account/push-subscriptions", { cache: "no-store" });
      const publicKeyResult = await publicKeyResponse.json();
      const applicationServerKey = publicKeyResult.publicKey as string | null;
      if (!applicationServerKey) throw new Error("Browser push is not configured for this website.");
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeBase64Url(applicationServerKey),
      });
      const response = await fetch("/api/account/push-subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), deviceLabel: "This browser" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to register this browser.");
      const deviceResponse = await fetch("/api/account/push-subscriptions", { cache: "no-store" });
      const deviceResult = await deviceResponse.json();
      if (deviceResponse.ok) setDevices(deviceResult.devices);
      setPreferences((current) => ({ ...current, push_enabled: true }));
      setSaved((current) => ({ ...current, push_enabled: true }));
      setStatus("Browser push is enabled for this device. Marketing alerts remain opt-in separately.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to enable browser notifications.");
    } finally {
      setSaving(false);
    }
  }

  async function testPush() {
    setSaving(true);
    try {
      const response = await fetch("/api/account/push-test", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send the test notification.");
      setStatus(result.result.sent
        ? `Test sent to ${result.result.sent} device${result.result.sent === 1 ? "" : "s"}.`
        : "Your test notification is being delivered.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send the test notification.");
    } finally {
      setSaving(false);
    }
  }

  async function removeDevice(id: string) {
    setSaving(true);
    try {
      const response = await fetch("/api/account/push-subscriptions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscriptionId: id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to remove this device.");
      setDevices((current) => current.filter((device) => device.id !== id));
      setStatus("Browser push was removed from this device.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to remove this device.");
    } finally {
      setSaving(false);
    }
  }

  const dirty = (Object.keys(preferences) as Array<keyof CustomerNotificationPreferences>)
    .some((key) => preferences[key] !== saved[key]);

  return (
    <section className="customer-notification-settings">
      <div>
        <p className="eyebrow">Privacy and delivery</p>
        <h2>Choose which updates you receive.</h2>
        <p>Order, payment, delivery, quote, and service notices are transactional. Promotional opt-ins are separate and can be withdrawn at any time.</p>
      </div>

      <div className="customer-notification-setting-group">
        <h3>Inbox and email</h3>
        <SettingToggle title="Customer inbox" description="Show updates in your signed-in Dantown inbox. Transactional delivery preferences are separate." checked={preferences.inbox_enabled} onChange={(value) => change("inbox_enabled", value)} />
        <SettingToggle title="Essential service email" description="Order, payment, quotation, and support emails where email delivery is configured." checked={preferences.transactional_email} onChange={(value) => change("transactional_email", value)} />
        <SettingToggle title="Marketing email channel" description="Allow opted-in offers and product announcements to be emailed." checked={preferences.marketing_email} onChange={(value) => change("marketing_email", value)} />
        <p className="customer-notification-note">{emailAvailable ? "Email delivery is configured for this site." : "No application email provider is configured yet. Inbox updates continue to work; email attempts are tracked as not configured until deployment setup is completed."}</p>
      </div>

      <div className="customer-notification-setting-group">
        <h3>Optional alerts and consent</h3>
        <SettingToggle title="Promotions and offer reminders" description="Optional promotional updates. Off by default." checked={preferences.promotions_opt_in} onChange={(value) => change("promotions_opt_in", value)} />
        <SettingToggle title="New product announcements" description="Optional announcements for newly published products. Off by default." checked={preferences.products_opt_in} onChange={(value) => change("products_opt_in", value)} />
        <SettingToggle title="Back-in-stock alerts" description="Allow alerts only for products you explicitly request." checked={preferences.back_in_stock_enabled} onChange={(value) => change("back_in_stock_enabled", value)} />
        <p className="customer-notification-note">Consent changes are timestamped and recorded as made in account settings.</p>
      </div>

      <div className="customer-notification-setting-group">
        <h3>Browser push</h3>
        <p>Browser permission is requested only when you press Enable on this device. Push permission does not subscribe you to marketing.</p>
        <p className="customer-notification-note">Status: {pushAvailable ? pushPermission : "Not configured"}{pushPermission === "denied" ? ". Change this site’s permission in your browser settings to try again." : ""}</p>
        <div className="customer-notification-button-row">
          <button type="button" className="button button-primary" disabled={saving || !pushAvailable} onClick={() => void enablePush()}>
            Enable push on this device
          </button>
          <button type="button" className="button button-secondary" disabled={saving || !devices.some((device) => device.active)} onClick={() => void testPush()}>
            Send test notification
          </button>
        </div>
        <SettingToggle title="Promotional push" description="Separate optional consent for marketing alerts through enabled browser devices." checked={preferences.push_marketing} onChange={(value) => change("push_marketing", value)} />
        {devices.length ? (
          <ul className="customer-push-device-list">
            {devices.map((device) => (
              <li key={device.id}>
                <span><strong>{device.device_label}</strong><small>{device.active ? "Active" : "Removed"} · Added {new Date(device.created_at).toLocaleDateString()}</small></span>
                {device.active ? <button type="button" disabled={saving} onClick={() => void removeDevice(device.id)}>Remove</button> : null}
              </li>
            ))}
          </ul>
        ) : <p className="customer-notification-note">No browser devices are registered.</p>}
      </div>

      <div className="customer-notification-setting-group">
        <h3>Quiet hours for nonessential push</h3>
        <p>Urgent service notices are not delayed. Optional product, promotion, and stock alerts wait until quiet hours end.</p>
        <div className="customer-notification-time-fields">
          <label>Start<input type="time" value={preferences.quiet_start ?? ""} onChange={(event) => change("quiet_start", event.target.value || null)} /></label>
          <label>End<input type="time" value={preferences.quiet_end ?? ""} onChange={(event) => change("quiet_end", event.target.value || null)} /></label>
          <label>Time zone<input value={preferences.timezone} onChange={(event) => change("timezone", event.target.value)} maxLength={64} /></label>
        </div>
      </div>
      <div className="customer-notification-settings-footer">
        <span role="status">{status}</span>
        <button type="button" className="button button-primary" disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </section>
  );
}

function SettingToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="customer-notification-toggle">
      <span><strong>{title}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
