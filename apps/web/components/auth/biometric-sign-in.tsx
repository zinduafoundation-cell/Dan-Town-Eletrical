"use client";

import { Fingerprint } from "lucide-react";
import { useEffect, useState } from "react";
import { isBiometricAvailable, signInWithBiometric } from "@/lib/auth/passkey-client";

/** "Staff sign-in with fingerprint or face" – only shown on phones/laptops that can do it. */
export function BiometricSignIn({ next }: { next?: string | null }) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void isBiometricAvailable().then(setAvailable); }, []);
  if (!available) return null;

  async function go() {
    setBusy(true);
    setError("");
    try {
      await signInWithBiometric();
      window.location.assign(next ? `/auth/complete?next=${encodeURIComponent(next)}` : "/auth/complete");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Biometric sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <div className="biometric-sign-in">
      <button type="button" className="google-sign-in" onClick={go} disabled={busy}>
        <Fingerprint size={18} aria-hidden="true" />
        {busy ? "Waiting for your fingerprint..." : "Staff: sign in with fingerprint or face"}
      </button>
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  );
}
