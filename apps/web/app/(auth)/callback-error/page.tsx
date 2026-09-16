/* eslint-disable @next/next/no-html-link-for-pages */
"use client";import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, CircleAlert, Home, RefreshCw } from "lucide-react";

export default function CallbackErrorPage() {
  const router = useRouter();
  useEffect(() => {
    const timeout = window.setTimeout(() => router.replace("/login"), 8000);
    return () => window.clearTimeout(timeout);
  }, [router]);

  return (
    <main className="auth-page callback-page">
      <section className="auth-panel callback-panel">
        <a className="brand" href="/">
          <span className="brand-mark">D</span>
          <span>DANTOWN <b>ELECTRICAL</b></span>
        </a>
        <div className="callback-icon"><CircleAlert size={24} /></div>
        <p className="eyebrow">AUTHENTICATION UPDATE</p>
        <h1>That link needs another try.</h1>
        <p className="auth-lead">The Google sign-in link may have expired or already been used. Start again to continue securely.</p>
        <div className="callback-actions">
          <Link className="button button-primary" href="/login">Continue to sign in <ArrowRight size={16} /></Link>
          <Link className="button button-secondary" href="/register">Create an account <RefreshCw size={16} /></Link>
        </div>
        <div className="callback-footer">
          <Link href="/"><Home size={14} /> Return to storefront</Link>
          <span>Returning to sign in in a few seconds</span>
        </div>
      </section>
    </main>
  );
}
