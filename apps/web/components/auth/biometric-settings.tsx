"use client";

import { Fingerprint, Smartphone, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetchWithBiometric, isBiometricAvailable, registerBiometric } from "@/lib/auth/passkey-client";

type Device = { id: string; label: string; createdAt: string; lastUsedAt: string | null };

function guessDeviceName() {
  const agent = navigator.userAgent;
  if (/Android/i.test(agent)) return "Android phone";
  if (/iPhone|iPad/i.test(agent)) return "iPhone / iPad";
  if (/Windows/i.test(agent)) return "Windows laptop";
  if (/Mac/i.test(agent)) return "Mac";
  return "This device";
}

/** Staff manage the devices that can unlock their account with a fingerprint or face. */
export function BiometricSettings() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/auth/passkey/devices", { cache: "no-store" });
    if (response.ok) setDevices(((await response.json()) as { devices: Device[] }).devices);
  }, []);

  useEffect(() => {
    void isBiometricAvailable().then(setSupported);
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function add() {
    setBusy(true);
    setMessage("");
    try {
      await registerBiometric(guessDeviceName());
      setMessage("Done. This device can now sign you in and confirm sensitive actions.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not link this device.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetchWithBiometric(`/api/auth/passkey/devices?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(((await response.json().catch(() => null)) as { error?: string } | null)?.error || "Could not remove this device.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove this device.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-card biometric-card" aria-labelledby="biometric-heading">
      <p className="eyebrow">Your security</p>
      <h2 id="biometric-heading"><Fingerprint size={20} aria-hidden="true" /> Fingerprint &amp; face unlock</h2>
      <p>
        Link each phone or computer separately after signing in with your staff account. Only a linked device can use its own
        fingerprint or face to sign you in, open the Dantown Centre lock, and approve sensitive actions. Your biometric data
        stays on that device. Remove a device here if it is lost or no longer trusted.
      </p>
      {devices.length ? (
        <ul className="biometric-devices">
          {devices.map((device) => (
            <li key={device.id}>
              <Smartphone size={16} aria-hidden="true" />
              <span><strong>{device.label}</strong><small>Linked {new Date(device.createdAt).toLocaleDateString("en-KE")}{device.lastUsedAt ? ` · last used ${new Date(device.lastUsedAt).toLocaleDateString("en-KE")}` : ""}</small></span>
              <button type="button" onClick={() => remove(device.id)} disabled={busy} aria-label={`Remove ${device.label}`}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      ) : <p className="centre-note">No device linked yet.</p>}
      <button type="button" className="button button-primary" onClick={add} disabled={busy || !supported}>
        {busy ? "Waiting for your fingerprint..." : devices.length ? "Link another device" : "Link this device"}
      </button>
      {!supported && <p className="centre-note">This device or browser cannot use fingerprint or face unlock. Use a supported browser with this device&apos;s screen lock over https or localhost.</p>}
      {message && <p className="centre-note" role="status">{message}</p>}
    </section>
  );
}
