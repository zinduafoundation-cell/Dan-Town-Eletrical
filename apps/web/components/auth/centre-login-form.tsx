"use client";

import Link from "next/link";
import { BriefcaseBusiness, LockKeyhole, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { createAuthClient } from "@dantown/auth";
import { BiometricSignIn } from "@/components/auth/biometric-sign-in";

const CENTRE_PATH = "/centre";

export function CentreLoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    setError("");
    try {
      if (rememberMe) {
        const response = await fetch("/api/auth/session-preference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rememberMe: true }),
        });
        if (!response.ok) {
          throw new Error("Could not save the 30-day sign-in preference. Please try again.");
        }
      }

      const { error: authError } = await createAuthClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(CENTRE_PATH)}`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (authError) throw authError;
    } catch (signInError) {
      console.error("CENTRE GOOGLE SIGN-IN ERROR", signInError);
      setError("Google sign-in is unavailable right now. Please try your staff email and password.");
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email")),
          password: String(form.get("password")),
          rememberMe,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "The email or password was not recognised.");
        return;
      }

      window.location.assign(`/auth/complete?next=${encodeURIComponent(CENTRE_PATH)}`);
    } catch (signInError) {
      console.error("CENTRE EMAIL SIGN-IN ERROR", signInError);
      setError("We could not complete sign-in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="centre-login-page">
      <section className="centre-login-card" aria-labelledby="centre-login-title">
        <Link className="centre-login-brand" href="/">
          <span className="centre-login-brand-mark">D</span>
          <span>DANTOWN <b>ELECTRICAL</b></span>
        </Link>
        <p className="centre-login-eyebrow">SECURE STAFF WORKSPACE</p>
        <h1 id="centre-login-title">Sign in to Dantown Centre</h1>
        <p className="centre-login-copy">
          Access is limited to staff accounts enabled by a Dantown administrator.
        </p>

        <div className="centre-login-security">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>Your account permissions are checked before Centre access is granted.</span>
        </div>

        {error ? <p className="auth-error" role="alert" aria-live="assertive">{error}</p> : null}

        <button
          type="button"
          className="centre-login-google"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          <span className="google-mark" aria-hidden="true">G</span>
          {loading ? "Connecting..." : "Continue with Google"}
        </button>
        <BiometricSignIn next={CENTRE_PATH} />

        <div className="centre-login-divider"><span>or use staff email</span></div>
        <form className="centre-login-form" onSubmit={submit}>
          <label>
            Work email
            <input name="email" type="email" autoComplete="username" required disabled={loading} />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required disabled={loading} />
          </label>
          <label className="centre-login-remember">
            <input
              name="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.currentTarget.checked)}
              disabled={loading}
            />
            <span>Keep me signed in for 30 days on this device</span>
          </label>
          <button className="centre-login-submit" type="submit" disabled={loading}>
            <LockKeyhole size={16} aria-hidden="true" />
            {loading ? "Signing in..." : "Sign in securely"}
          </button>
        </form>

        <p className="centre-login-no-access">
          Need Centre access? Ask your Dantown administrator to enable your staff account.
        </p>
        <div className="centre-login-footer">
          <Link href="/forgot-password">Forgot password?</Link>
          <Link href="/login">Customer sign in</Link>
        </div>
        <div className="centre-login-role-note">
          <BriefcaseBusiness size={14} aria-hidden="true" />
          <span>Centre access and available tools are assigned by your administrator.</span>
        </div>
      </section>
    </main>
  );
}
