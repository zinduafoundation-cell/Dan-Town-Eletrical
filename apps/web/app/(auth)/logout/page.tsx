"use client";import { useEffect } from "react";
import { useRouter } from "next/navigation";export default function LogoutPage() { const router = useRouter(); useEffect(() => { fetch("/api/auth/logout", { method : "POST" }).finally(() => { router.push("/"); }); }, [router]); return <main className="auth-page"><p>Signing out...</p></main>; }
