"use client";

import { useEffect, useState } from "react";

const CONSENT_STORAGE_KEY = "dantown-cookie-consent";

export function CookieConsent() {
  const [consent, setConsent] = useState<string | null>(null);
  const [customizing, setCustomizing] = useState(false);

  useEffect(() => {
    queueMicrotask(() =>
      setConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY))
    );
  }, []);

  const saveConsent = (value: string) => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
    setConsent(value);
    setCustomizing(false);
  };

  if (consent) return null;

  return (
    <aside className="cookie-consent" aria-label="Cookie consent">
      <div className="cookie-consent-copy">
        <p>
          This website uses cookies to ensure you get the best experience.{" "}
          <a
            href="https://www.tronic.co.ke/policies/privacy-policy"
            target="_blank"
            rel="noreferrer"
          >
            Privacy Policy
          </a>
        </p>
        {customizing && (
          <small>
            Essential cookies are always enabled. Choose Accept All to allow
            optional cookies, or Decline to use essential cookies only.
          </small>
        )}
      </div>
      <div className="cookie-consent-actions">
        <button type="button" onClick={() => saveConsent("accepted")}>
          Accept All
        </button>
        <button type="button" onClick={() => saveConsent("declined")}>
          Decline
        </button>
        <button
          type="button"
          className="cookie-consent-customize"
          onClick={() => setCustomizing((isCustomizing) => !isCustomizing)}
          aria-expanded={customizing}
        >
          Customize
        </button>
      </div>
    </aside>
  );
}
