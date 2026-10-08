"use client";

import { Check, MessageCircle } from "lucide-react";
import { useState } from "react";

/** Copies a ready-to-send supplier message (paste into WhatsApp). */
export function ReorderCopyButton({ lines }: { lines: Array<{ name: string; sku: string; suggested: number }> }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const text = `Hello, Dantown Electrical Kitale would like to order:\n${lines.map((line) => `• ${line.suggested} × ${line.name} (${line.sku})`).join("\n")}\nPlease confirm availability and price. Thank you.`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  return <button type="button" className="button button-quiet" onClick={copy}>{copied ? <Check size={15} /> : <MessageCircle size={15} />} {copied ? "Copied — paste in WhatsApp" : "Copy supplier order message"}</button>;
}
