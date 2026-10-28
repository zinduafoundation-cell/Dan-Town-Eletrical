"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AuthSessionContextValue = {
  userId: string | null;
  status: "loading" | "ready";
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);
let inFlightSessionRequest: Promise<string | null> | null = null;

export function getCurrentSessionUserId() {
  if (!inFlightSessionRequest) {
    const request = fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const session: unknown = await response.json();
        return typeof session === "object" &&
          session !== null &&
          "userId" in session &&
          typeof session.userId === "string"
          ? session.userId
          : null;
      })
      .catch(() => null);
    inFlightSessionRequest = request;
    void request.finally(() => {
      if (inFlightSessionRequest === request) inFlightSessionRequest = null;
    });
  }
  return inFlightSessionRequest;
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthSessionContextValue["status"]>("loading");

  useEffect(() => {
    let active = true;
    void getCurrentSessionUserId().then((sessionUserId) => {
      if (!active) return;
      setUserId(sessionUserId);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({ userId, status }),
    [userId, status],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) throw new Error("useAuthSession must be used within AuthSessionProvider");
  return context;
}
