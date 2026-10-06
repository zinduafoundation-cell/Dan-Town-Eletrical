"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, User } from "lucide-react";
import { getSignedInAccountLinks, type AccountNavLink } from "./account-navigation";

export function AccountMenu({ accountLabel = "Account", accountLinks = getSignedInAccountLinks() }: { accountLabel?: string; accountLinks?: AccountNavLink[] }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ userId: string | null }> : { userId: null })
      .then((session: { userId: string | null }) => { setSignedIn(Boolean(session.userId)); })
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

  const visibleLinks = signedIn ? getSignedInAccountLinks(accountLinks).slice(0, 6) : [{ label: "Sign in", href: "/login" }, { label: "Create account", href: "/register" }];

  return <details className="account-popover" ref={menuRef}>
    <summary aria-label="Account menu" aria-haspopup="menu"><User size={16} /><span>{signedIn === null ? accountLabel : label}</span><ChevronDown size={14} /></summary>
    <div className="popover-panel">
      {signedIn ? <>{visibleLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}<Link href="/logout">Sign out</Link></> : <>{visibleLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}</>}
    </div>
  </details>;
}
