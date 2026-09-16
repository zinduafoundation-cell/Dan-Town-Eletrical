"use client";

import { X, Zap } from "lucide-react";
import { useEffect, useState } from "react";

const ENTRY_KEY = "dantown-entry-seen-v1";

export function WelcomeEntry() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.sessionStorage.getItem(ENTRY_KEY)) return;
    const showTimer = window.setTimeout(() => setVisible(true), 0);
    const hideTimer = window.setTimeout(() => {
      window.sessionStorage.setItem(ENTRY_KEY, "seen");
      setVisible(false);
    }, 2100);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  function skip() {
    window.sessionStorage.setItem(ENTRY_KEY, "seen");
    setVisible(false);
  }

  if (!visible) return null;
  return (
    <div className="welcome-entry" role="dialog" aria-modal="true" aria-label="Welcome to Dantown">
      <button className="welcome-entry-skip" type="button" onClick={skip} aria-label="Skip welcome"><X size={17} /> Skip</button>
      <div className="welcome-entry-card">
        <span className="welcome-entry-mark"><Zap size={27} /></span>
        <p className="eyebrow">Dantown Electrical Kitale</p>
        <h1>Powering Kitale, one home at a time.</h1>
        <p>Solar <span>•</span> Electrical <span>•</span> Lighting <span>•</span> Security</p>
      </div>
    </div>
  );
}
