"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, User } from "lucide-react";

export function AccountMenu({ accountLabel = "Account", accountLinks = [{ label: "Account overview", href: "/account" }] }: { accountLabel?: string; accountLinks?: Array<{ label: string; href: string }> }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [canAccessWorkspace, setCanAccessWorkspace] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ userId: string | null; canAccessWorkspace?: boolean }> : { userId: null })
      .then((session: { userId: string | null; canAccessWorkspace?: boolean }) => { setSignedIn(Boolean(session.userId)); setCanAccessWorkspace(Boolean(session.canAccessWorkspace)); })
      .catch(() => setSignedIn(false));
  }, []);

  const label = signedIn ? "My account" : "Sign in";
  useEffect(() => {
    function closeMenu(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") menuRef.current?.removeAttribute("open");
        return;
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        menuRef.current.removeAttribute("open");
      }
    }
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, []);

  return <details className="account-popover" ref={menuRef}>
    <summary aria-label="Account menu" aria-haspopup="menu"><User size={16} /><span>{signedIn === null ? accountLabel : label}</span><ChevronDown size={14} /></summary>
    <div className="popover-panel">
      {signedIn ? <>{accountLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}<Link href="/account/orders">Orders</Link><Link href="/account/quotes">Quotations</Link>{canAccessWorkspace && <Link href="/business">Workspaces</Link>}<Link href="/logout">Sign out</Link></> : <><Link href="/login">Sign in</Link><Link href="/register">Create account</Link></>}
    </div>
  </details>;
}
