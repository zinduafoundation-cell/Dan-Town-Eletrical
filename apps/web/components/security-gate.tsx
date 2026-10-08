"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Fingerprint, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { confirmWithBiometric, isBiometricAvailable } from "@/lib/auth/passkey-client";

export function SecurityGate({ pinEnabled = true, hasBiometric = false }: { pinEnabled?: boolean; hasBiometric?: boolean }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [canUseBiometric, setCanUseBiometric] = useState(false);

  useEffect(() => { if (hasBiometric) void isBiometricAvailable().then(setCanUseBiometric); }, [hasBiometric]);

  async function unlockWithBiometric() {
    setLoading(true);
    setError(null);
    try {
      await confirmWithBiometric();
      window.location.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Biometric check failed.");
      setLoading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/auth/quick-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
    const result = (await response.json()) as { ok: boolean; error: string; locked: boolean };
    if (response.ok && result.ok) window.location.reload();
    else setError(result.locked ? "Too many attempts. Try again later." : result.error || "Unable to verify access.");
    setLoading(false);
  }

  return (
    <main className="security-gate">
      <section className="security-gate-panel">
        <div className="security-gate-brand"><span className="brand-mark">D</span><strong>DANTOWN ELECTRICAL</strong></div>
        <div className="security-gate-icon"><LockKeyhole size={24} /></div>
        <p className="eyebrow">Secure access</p>
        <h1>Confirm your workspace.</h1>
        {canUseBiometric && (
          <>
            <p>Use your fingerprint or face to continue to the protected business area.</p>
            <button className="button button-primary" type="button" onClick={unlockWithBiometric} disabled={loading}><Fingerprint size={17} /> {loading ? "Waiting..." : "Unlock with fingerprint / face"}</button>
          </>
        )}
        {pinEnabled && (
          <>
            <p>{canUseBiometric ? "Or enter" : "Enter"} the secondary access PIN to continue to the protected business area.</p>
            <form onSubmit={submit}>
              <label htmlFor="quick-access-pin">Access PIN</label>
              <input id="quick-access-pin" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={12} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} autoComplete="one-time-code" required />
              <button className="button button-primary" type="submit" disabled={loading || pin.length < 4}>{loading ? "Checking..." : "Continue"}</button>
            </form>
          </>
        )}
        {!pinEnabled && !canUseBiometric && <p>Link a fingerprint or face on this phone from your staff page, then come back here.</p>}
        {error && <p className="security-gate-error" role="alert">{error}</p>}
        <Link className="security-gate-back" href="/"><ArrowLeft size={15} /> Back to Dantown</Link>
      </section>
    </main>
  );
}
