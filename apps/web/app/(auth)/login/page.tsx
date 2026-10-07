/* eslint-disable @next/next/no-html-link-for-pages */
"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createAuthClient } from "@dantown/auth";
import { buttonClassName } from "@dantown/ui";

function requestedNextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : null;
}

function completePath() {
  const next = requestedNextPath();
  return next ? `/auth/complete?next=${encodeURIComponent(next)}` : "/auth/complete";
}

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    void createAuthClient().auth.getSession()
      .then(({ data: { session } }) => {
        if (active && session) window.location.assign(completePath());
        else if (active) setCheckingSession(false);
      })
      .catch((sessionError: unknown) => {
        console.error("EXISTING SESSION CHECK ERROR", sessionError);
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function signInWithGoogle() {
    setLoading(true);
    setError("");
    try {
      const preferenceResponse = await fetch("/api/auth/session-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rememberMe }),
      });
      if (!preferenceResponse.ok) {
        throw new Error("Could not save the sign-in preference.");
      }

      const { error: authError } = await createAuthClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback${requestedNextPath() ? `?next=${encodeURIComponent(requestedNextPath()!)}` : ""}`,
          queryParams: { prompt: "select_account" }
        }
      });
      if (authError) throw authError;
    } catch (authError) {
      console.error("GOOGLE SIGN-IN ERROR", authError);
      setError("Google sign-in is unavailable right now. Please try email and password.");
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

      window.location.assign(completePath());
    } catch (signInError) {
      console.error("EMAIL SIGN-IN ERROR", signInError);
      setError("We could not complete sign-in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <a className="brand" href="/">
          <span className="brand-mark">D</span>
          <span>DANTOWN <b>ELECTRICAL</b></span>
        </a>
        <h1>Welcome back.</h1>
        <p className="auth-lead">
          {checkingSession ? "Checking for a saved sign-in..." : "Sign in to manage your account and orders."}
        </p>
        {error && <p className="auth-error" role="alert" aria-live="assertive">{error}</p>}
        <button type="button" className="google-sign-in" onClick={signInWithGoogle} disabled={loading || checkingSession}>
          <span className="google-mark">G</span>
          {loading ? "Connecting..." : "Continue with Google"}
        </button>
        <div className="auth-divider"><span>or use email</span></div>
        <form className="auth-form" onSubmit={submit}>
          <label>Email<input name="email" type="email" autoComplete="email" required disabled={checkingSession} /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required disabled={checkingSession} /></label>
          <label className="auth-remember">
            <input
              name="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.currentTarget.checked)}
              disabled={checkingSession}
            />
            <span>Remember me on this device for 30 days</span>
          </label>
          <p className="auth-remember-note">Signing out still ends your session. We never save your password.</p>
          <Link className="text-link" href="/forgot-password">Forgot password</Link>
          <button className={buttonClassName()} disabled={loading || checkingSession}>
            {checkingSession ? "Checking session..." : loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="auth-switch">New to Dantown <Link href="/register">Create an account</Link></p>
      </section>
    </main>
  );
}
