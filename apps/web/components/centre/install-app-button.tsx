"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * "Install app" button for the Dantown Centre. Uses the browser install prompt
 * when available and otherwise explains how to install from the browser menu.
 */
export function InstallCentreApp() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      setPromptEvent(null);
      return;
    }
    setHelp((open) => !open);
  }

  return (
    <span className="centre-install-wrap">
      <button type="button" className="centre-install-button" onClick={install}>
        <Download size={16} aria-hidden="true" />
        <span>Install Centre app</span>
      </button>
      {help ? (
        <span className="centre-install-help" id="centre-install-help" role="status">
          {ios
            ? "Tap the Share button, then choose Add to Home Screen."
            : "Open your browser menu and choose Install app or Add to Home Screen."}
        </span>
      ) : null}
    </span>
  );
}
