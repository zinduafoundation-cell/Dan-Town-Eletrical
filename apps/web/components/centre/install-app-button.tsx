"use client";

import { Download } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isAppInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function subscribeToInstallation(callback: () => void) {
  const standaloneQuery = window.matchMedia("(display-mode: standalone)");
  standaloneQuery.addEventListener("change", callback);
  window.addEventListener("appinstalled", callback);

  return () => {
    standaloneQuery.removeEventListener("change", callback);
    window.removeEventListener("appinstalled", callback);
  };
}

function isIosBrowser() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * "Install app" button for the Dantown Centre. Uses the browser install prompt
 * when available and otherwise explains how to install from the browser menu.
 */
export function InstallCentreApp() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const installed = useSyncExternalStore(
    subscribeToInstallation,
    isAppInstalled,
    () => false,
  );
  const ios = useSyncExternalStore(
    () => () => {},
    isIosBrowser,
    () => false,
  );
  const [help, setHelp] = useState(false);
  const [installMessage, setInstallMessage] = useState("");

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        setPromptEvent(null);
        setInstallMessage(
          choice.outcome === "accepted"
            ? "Dantown app added to your device."
            : "Install was cancelled. You can install later from your browser menu.",
        );
      } catch (error) {
        console.error("Unable to open the Centre app install prompt.", error);
        setInstallMessage(
          "Open your browser menu and choose Install app or Add to Home Screen.",
        );
      }
      setHelp(true);
      return;
    }
    setInstallMessage(
      ios
        ? "Tap the Share button, then choose Add to Home Screen."
        : "Open your browser menu and choose Install app or Add to Home Screen.",
    );
    setHelp((open) => !open);
  }

  return (
    <span className="centre-install-wrap">
      <button
        type="button"
        className="centre-install-button"
        onClick={install}
        aria-expanded={help}
        aria-controls="centre-install-help"
      >
        <Download size={16} aria-hidden="true" />
        <span>Download app</span>
      </button>
      {help ? (
        <span className="centre-install-help" id="centre-install-help" role="status">
          {installMessage}
        </span>
      ) : null}
    </span>
  );
}
