/* eslint-disable @next/next/no-html-link-for-pages */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createAuthClient } from "@dantown/auth";
import { buttonClassName } from "@dantown/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signUpWithGoogle() {
    setLoading(true);
    setError("");
    const { error: authError } = await createAuthClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/account")}`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (authError) {
      setError("Google sign-up is unavailable right now. Please use the form below.");
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmPassword")) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const email = String(form.get("email"));
    const fullName = String(form.get("fullName"));
    const phone = String(form.get("phone"));
    const password = String(form.get("password"));

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          password,
          termsAccepted: form.get("terms") === "on",
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem("verificationEmail", email);
      }

      if (result.verificationRequired === false) {
        router.push("/login");
        return;
      }

      router.push("/auth/verify-email");
    } catch (err) {
      console.error("REGISTRATION EXCEPTION", err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <a className="brand" href="/">
          <span className="brand-mark">D</span>
          <span>
            DANTOWN <b>ELECTRICAL</b>
          </span>
        </a>
        <h1>Create your account.</h1>
        <p className="auth-lead">Join Dantown for easier ordering, quotes and order tracking.</p>
        {error && <p className="auth-error">{error}</p>}
        <button type="button" className="google-sign-in" onClick={signUpWithGoogle} disabled={loading}>
          <span className="google-mark">G</span>
          {loading ? "Connecting..." : "Join with Google"}
        </button>
        <div className="auth-divider">
          <span>or use email</span>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label>
            Full name <input name="fullName" autoComplete="name" required />
          </label>
          <label>
            Email <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Phone <input name="phone" type="tel" autoComplete="tel" required />
          </label>
          <label>
            Password <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label>
            Confirm password <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label>
            <span>
              <input name="terms" type="checkbox" required /> I accept the account terms.
            </span>
          </label>
          <button className={buttonClassName()} disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}

