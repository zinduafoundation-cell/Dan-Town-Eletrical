/* eslint-disable @next/next/no-html-link-for-pages */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClassName } from "@dantown/ui";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.sessionStorage.getItem("verificationEmail") || "";
  });
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!email) {
      router.replace("/register");
    }
  }, [email, router]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((current) => current - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  async function handleResend() {
    setResendLoading(true);
    setResendError("");
    setResendSuccess(false);

    try {
      const response = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();
      if (!response.ok) {
        setResendError(result.error || "Failed to resend verification email. Please try again.");
        setResendLoading(false);
        return;
      }

      setResendSuccess(true);
      setResendCooldown(60);
      setResendLoading(false);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err) {
      console.error("RESEND EXCEPTION", err);
      setResendError("An unexpected error occurred. Please try again.");
      setResendLoading(false);
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
        <h1>Check your inbox.</h1>
        <p className="auth-lead">We&apos;ve sent a verification link to:</p>
        <p style={{ fontSize: "1.1em", fontWeight: 600, marginBottom: "1.5em", color: "#333" }}>{email}</p>
        <div className="auth-form">
          <p style={{ marginBottom: "1em", fontSize: "0.95em", lineHeight: 1.6 }}>
            Click the verification link in your email to activate your Dantown account. The link will expire in 24 hours.
          </p>
          <p style={{ marginBottom: "1em", fontSize: "0.95em", lineHeight: 1.6, fontWeight: 500 }}>Don&apos;t see the email?</p>
          <ul style={{ marginBottom: "1.5em", paddingLeft: "1.5em", fontSize: "0.9em", lineHeight: 1.8 }}>
            <li>Check your Spam or Junk folder</li>
            <li>Search your inbox for &quot;Dantown&quot;</li>
            <li>Confirm the email address is correct</li>
          </ul>
          {resendError && (
            <p style={{ color: "#d32f2f", marginBottom: "1em", fontSize: "0.95em" }}>⚠ {resendError}</p>
          )}
          {resendSuccess && (
            <p style={{ color: "#388e3c", marginBottom: "1em", fontSize: "0.95em" }}>✓ Verification email sent successfully!</p>
          )}
          <button className={buttonClassName()} onClick={handleResend} disabled={resendLoading || resendCooldown > 0} style={{ marginBottom: "1em" }}>
            {resendLoading ? "Sending..." : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend verification email"}
          </button>
          <p style={{ fontSize: "0.9em", borderTop: "1px solid #e0e0e0", paddingTop: "1em", marginTop: "1em" }}>
            <Link href="/register">Use a different email address</Link>
          </p>
          <p className="auth-switch">
            <Link href="/login">Back to sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

