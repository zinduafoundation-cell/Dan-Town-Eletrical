"use client";

import { ChevronUp, CircleHelp, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const whatsappHref = `https://wa.me/254745917655?text=${encodeURIComponent("Hello Dantown, I need help with an electrical product.")}`;

export function FloatingSupportHub() {
  const [open, setOpen] = useState(false);
  const hubRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
        return;
      }
      if (hubRef.current && !hubRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  function openHelp() {
    window.dispatchEvent(new CustomEvent("dantown-open-help"));
    setOpen(false);
  }

  return (
    <div className="floating-support-hub" ref={hubRef}>
      {open ? (
        <div className="floating-support-panel" role="menu" aria-label="Dantown support options">
          <strong>Need a hand?</strong>
          <button type="button" onClick={openHelp} role="menuitem"><CircleHelp size={18} /> Help centre</button>
          <a href={whatsappHref} target="_blank" rel="noreferrer" role="menuitem"><MessageCircle size={18} /> WhatsApp Dantown</a>
        </div>
      ) : null}
      <button className="floating-support-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Close support options" : "Open support options"}>
        {open ? <X size={21} /> : <CircleHelp size={21} />}
        <span>Support</span>
        {!open && <ChevronUp size={14} aria-hidden="true" />}
      </button>
    </div>
  );
}
