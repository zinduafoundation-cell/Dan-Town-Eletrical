"use client";

import { useState } from "react";
import type {
  PaymentProviderReadiness,
  PaymentProviderSettings,
} from "@/lib/payments/payment-provider-options";
import {
  paymentProviderReadinessSchema,
  paymentProviderSettingsSchema,
} from "@/lib/payments/payment-provider-options";

type Props = {
  initialSettings: PaymentProviderSettings;
  initialReadiness: PaymentProviderReadiness;
  updatedAt: string | null;
};

const methods = [
  {
    key: "onlinePesapalEnabled",
    label: "Pesapal — website checkout",
    readiness: (state: PaymentProviderReadiness) => state.pesapal.online,
    setup: (state: PaymentProviderReadiness) => state.pesapal.configured
      ? "Pesapal credentials are configured on the server."
      : "Add PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET, PESAPAL_IPN_ID, and PESAPAL_ENVIRONMENT to the server environment.",
  },
  {
    key: "posPesapalEnabled",
    label: "Pesapal — point of sale",
    readiness: (state: PaymentProviderReadiness) => state.pesapal.pos,
    setup: (state: PaymentProviderReadiness) => state.pesapal.configured
      ? "Pesapal credentials are configured on the server."
      : "Add Pesapal credentials to the server environment before taking POS payments.",
  },
  {
    key: "onlinePaystackEnabled",
    label: "Paystack — website checkout",
    readiness: (state: PaymentProviderReadiness) => state.paystack.online,
    setup: (state: PaymentProviderReadiness) => state.paystack.mode
      ? `Paystack ${state.paystack.mode} credentials are configured on the server.`
      : "Add a PAYSTACK_SECRET_KEY (sk_test_... or sk_live_...) to the server environment.",
  },
] as const;

export function PaymentProviderSettingsForm({
  initialSettings,
  initialReadiness,
  updatedAt,
}: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const [readiness, setReadiness] = useState(initialReadiness);
  const [lastUpdated, setLastUpdated] = useState(updatedAt);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dirty = methods.some(({ key }) => settings[key] !== savedSettings[key]);

  const save = async () => {
    if (
      !savedSettings.onlinePaystackEnabled &&
      settings.onlinePaystackEnabled &&
      readiness.paystack.mode === "live" &&
      !window.confirm("Enable Paystack live payments on the public website?")
    ) return;

    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/payment-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const result: unknown = await response.json();
      if (!response.ok || typeof result !== "object" || result === null) {
        const reason = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : "Unable to save payment settings.";
        throw new Error(reason);
      }
      if (!("settings" in result) || !("readiness" in result)) {
        throw new Error("The saved payment settings response was invalid.");
      }
      const settingsResult = paymentProviderSettingsSchema.safeParse(result.settings);
      const readinessResult = paymentProviderReadinessSchema.safeParse(result.readiness);
      if (!settingsResult.success || !readinessResult.success) {
        throw new Error("The saved payment settings response was invalid.");
      }
      setSettings(settingsResult.data);
      setSavedSettings(settingsResult.data);
      setReadiness({
        pesapal: readinessResult.data.pesapal,
        paystack: {
          mode: readinessResult.data.paystack.mode ?? null,
          online: readinessResult.data.paystack.online,
        },
      });
      setLastUpdated("updatedAt" in result && typeof result.updatedAt === "string" ? result.updatedAt : new Date().toISOString());
      setMessage("Payment method settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save payment settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="payment-provider-settings" aria-labelledby="payment-provider-settings-title">
      <div className="payment-provider-settings-heading">
        <div>
          <h3 id="payment-provider-settings-title">Payment provider availability</h3>
          <p>Enable providers for the website and supported POS routes. A provider is offered only when its server credentials are also present; POS cash is recorded separately.</p>
        </div>
        <span className="payment-provider-updated">
          {lastUpdated ? `Last saved ${new Date(lastUpdated).toLocaleString()}` : "Using safe defaults"}
        </span>
      </div>
      <div className="payment-provider-options">
        {methods.map((method) => (
          <label className="payment-provider-option" key={method.key}>
            <input
              type="checkbox"
              checked={settings[method.key]}
              onChange={(event) => setSettings((current) => ({
                ...current,
                [method.key]: event.target.checked,
              }))}
              disabled={saving}
            />
            <span>
              <strong>{method.label}</strong>
              <small>{method.readiness(readiness) ? "Ready and enabled" : method.setup(readiness)}</small>
            </span>
          </label>
        ))}
      </div>
      <p className="payment-provider-security-note">
        Gateway secrets are read from server environment variables and are never stored in this database or returned to the browser. Do not enable live transactions until sandbox tests pass.
      </p>
      {message && <p className="settings-save-success" role="status">{message}</p>}
      {error && <p className="settings-save-error" role="alert">{error}</p>}
      <div className="payment-provider-actions">
        <button className="button button-primary" type="button" onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save payment settings"}
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => {
            setSettings(savedSettings);
            setError("");
            setMessage("");
          }}
          disabled={!dirty || saving}
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
