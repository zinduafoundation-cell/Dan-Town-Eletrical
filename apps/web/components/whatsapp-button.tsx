"use client";

import { MessageCircle } from "lucide-react";

const whatsappNumber = "254745917655";

export function WhatsAppButton() {
  const href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hello Dantown, I need help with an electrical product.")}`;
  return (
    <a className="whatsapp-float" href={href} target="_blank" rel="noreferrer" aria-label="Chat with Dantown on WhatsApp" title="Chat with Dantown">
      <MessageCircle size={21} aria-hidden="true" />
      <span>Chat with Dantown</span>
    </a>
  );
}
