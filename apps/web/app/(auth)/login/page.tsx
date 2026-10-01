/* eslint-disable @next/next/no-html-link-for-pages */
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createAuthClient } from "@dantown/auth";
import { buttonClassName } from "@dantown/ui";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nextPath = () => {
    const next = new URLSearchParams(window.location.search).get("next");
    return next?.startsWith("/") && !next.startsWith("//") ? next : "/account";
  };

  async function signInWithGoogle() {
    setLoading(true);
    setError("");
    try {
      const { error: authError } = await createAuthClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}`,
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
      const { error: authError } = await createAuthClient().auth.signInWithPassword({
        email: String(form.get("email")),
        password: String(form.get("password"))
      });
      if (authError) {
        setError("The email or password was not recognised.");
        return;
      }

      const provisioningResponse = await fetch("/api/auth/provision", { method: "POST" });
      if (!provisioningResponse.ok) {
        setError("We could not finish setting up your account. Please try again.");
        return;
      }

      router.push(nextPath());
      router.refresh();
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
        <p className="auth-lead">Sign in to manage your account and orders.</p>
        {error && <p className="auth-error" role="alert" aria-live="assertive">{error}</p>}
        <button type="button" className="google-sign-in" onClick={signInWithGoogle} disabled={loading}>
          <span className="google-mark">G</span>
          {loading ? "Connecting..." : "Continue with Google"}
        </button>
        <div className="auth-divider"><span>or use email</span></div>
        <form className="auth-form" onSubmit={submit}>
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          <Link className="text-link" href="/forgot-password">Forgot password</Link>
          <button className={buttonClassName()} disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        </form>
        <p className="auth-switch">New to Dantown <Link href="/register">Create an account</Link></p>
      </section>
    </main>
  );
}
