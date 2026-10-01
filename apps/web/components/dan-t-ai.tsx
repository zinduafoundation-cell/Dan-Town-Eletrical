"use client";

import { FormEvent, useEffect, useRef, useState, type PointerEvent } from "react";
import { Bot, Send, X } from "lucide-react";
import Link from "next/link";

type Message = { role: "user" | "assistant"; content: string };
const suggestions = ["Find a 2.5mm cable", "Do you have sockets?", "How do I request a quotation?", "Where is my order?"];

function getSessionId() {
  const key = "dantown-ai-session-id";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const sessionId = crypto.randomUUID();
  window.sessionStorage.setItem(key, sessionId);
  return sessionId;
}

export function DanTAI() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [escalationSuggested, setEscalationSuggested] = useState(false);
  const [escalationMessage, setEscalationMessage] = useState<string | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const smartMatchSuggested = messages.some((message) => /\b(quotation|quote|invoice|upload|photo|picture|image|identify|match)\b/i.test(message.content));
  const dragState = useRef<{ offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("dantown-ai-position");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { x?: number; y?: number };
      if (typeof parsed.x === "number" && typeof parsed.y === "number") window.setTimeout(() => setPosition(clampPosition(parsed.x as number, parsed.y as number)), 0);
    } catch {
      window.localStorage.removeItem("dantown-ai-position");
    }
  }, []);

  useEffect(() => {
    if (position) window.localStorage.setItem("dantown-ai-position", JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    function keepOnScreen() {
      setPosition((current) => current ? clampPosition(current.x, current.y) : current);
    }
    window.addEventListener("resize", keepOnScreen);
    return () => window.removeEventListener("resize", keepOnScreen);
  }, []);

  function startDragging(event: PointerEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    dragState.current = { offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function drag(event: PointerEvent<HTMLButtonElement>) {
    if (!dragState.current) return;
    const next = clampPosition(event.clientX - dragState.current.offsetX, event.clientY - dragState.current.offsetY);
    if (Math.abs((position?.x ?? next.x) - next.x) > 3 || Math.abs((position?.y ?? next.y) - next.y) > 3) dragState.current.moved = true;
    setPosition(next);
  }

  function stopDragging() {
    if (!dragState.current) return;
    const { moved } = dragState.current;
    dragState.current = null;
    suppressClick.current = moved;
  }

  async function ask(question: string) {
    const message = question.trim();
    if (!message || loading) return;
    const nextMessages = [...messages, { role: "user" as const, content: message }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history: messages.slice(-12) }) });
      const result = await response.json() as { answer?: string; error?: string; escalationSuggested?: boolean };
      if (!response.ok || !result.answer) throw new Error(result.error || "DAN T AI is temporarily unavailable.");
      setMessages([...nextMessages, { role: "assistant", content: result.answer }]);
      setEscalationSuggested(Boolean(result.escalationSuggested));
    } catch (requestError) {
      setMessages(messages);
      setInput(message);
      setError(requestError instanceof Error ? requestError.message : "DAN T AI is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  async function escalate() {
    setEscalationMessage(null);
    const response = await fetch("/api/ai/escalate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: getSessionId(), summary: messages.map((message) => `${message.role}: ${message.content}`).slice(-6).join("\n").slice(-1000) }) });
    const result = await response.json() as { escalationId?: string; error?: string };
    setEscalationMessage(response.ok ? `Support request created: ${result.escalationId}` : result.error || "Support request could not be created.");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(input);
  }

  return <>
    <button className="dan-ai-launcher" type="button" style={position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined} onPointerDown={startDragging} onPointerMove={drag} onPointerUp={stopDragging} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setOpen(true); }} aria-label="Open DAN T AI" title="Ask DAN T AI"><Bot size={20} /><span>DAN T AI</span></button>
    {open && <aside className="dan-ai-panel" aria-label="DAN T AI assistant">
      <header className="dan-ai-header"><div><strong>DAN T AI</strong><small>Dantown Electrical assistant</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Close DAN T AI"><X size={18} /></button></header>
      <div className="dan-ai-messages" aria-live="polite">
        {!messages.length && <div className="dan-ai-welcome"><Bot size={28} /><strong>How can I help?</strong><p>I can help you find products, check confirmed information, and guide you through Dantown services.</p><div className="dan-ai-suggestions">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void ask(suggestion)}>{suggestion}</button>)}</div></div>}
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`dan-ai-message ${message.role}`}><span>{message.content}</span></div>)}
        {smartMatchSuggested && <Link className="dan-ai-handoff" href="/ai/smart-match">Scan a quotation or product photo</Link>}
        {loading && <div className="dan-ai-message assistant"><span className="dan-ai-typing">DAN T AI is checking...</span></div>}
        {error && <div className="dan-ai-error"><span>{error}</span><button type="button" onClick={() => void ask(input)}>Retry</button></div>}
        {escalationSuggested && !escalationMessage && <button className="dan-ai-handoff" type="button" onClick={() => void escalate()}>Talk to a Dantown team member</button>}
        {escalationMessage && <p className="dan-ai-escalation" role="status">{escalationMessage}</p>}
      </div>
      <form className="dan-ai-form" onSubmit={submit}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask DAN T AI..." aria-label="Ask DAN T AI" maxLength={1200} /><button type="submit" disabled={loading || !input.trim()} aria-label="Send question"><Send size={17} /></button></form>
    </aside>}
  </>;
}

function clampPosition(x: number, y: number) {
  const margin = 16;
  const width = 130;
  const height = 48;
  return {
    x: Math.min(Math.max(margin, x), Math.max(margin, window.innerWidth - width - margin)),
    y: Math.min(Math.max(margin, y), Math.max(margin, window.innerHeight - height - margin))
  };
}