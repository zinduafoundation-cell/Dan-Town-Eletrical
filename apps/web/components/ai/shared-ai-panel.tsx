"use client";

import { FormEvent, useMemo, useState } from "react";
import { Bot, Send, Sparkles, ShieldAlert, X } from "lucide-react";

export type SharedAIPanelProps = {
  title: string;
  subtitle: string;
  surface: "storefront" | "centre" | "pos" | "admin";
  suggestions?: string[];
  compact?: boolean;
};

type Message = { role: "user" | "assistant"; content: string };

export function SharedAIPanel({ title, subtitle, surface, suggestions = [], compact = false }: SharedAIPanelProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultSuggestions = useMemo(() => suggestions.length ? suggestions : [
    surface === "centre" ? "What needs my attention today?" :
    surface === "pos" ? "What is waiting to sync?" :
    surface === "admin" ? "Give me a complete business summary." : "How can I help?"
  ], [surface, suggestions]);

  async function ask(question: string) {
    const message = question.trim();
    if (!message || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content: message }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, surface, history: nextMessages.slice(-12) })
      });
      const result = await response.json() as { answer?: string; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error || "DAN T AI is temporarily unavailable.");
      setMessages([...nextMessages, { role: "assistant", content: result.answer }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "DAN T AI is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(input);
  }

  return (<>
    {compact ? (
      <button type="button" className="portal-card ai-inline-trigger" onClick={() => setOpen(true)}>
        <Sparkles size={18} />
        <span>{title}</span>
      </button>
    ) : (
      <button type="button" className="dan-ai-launcher" onClick={() => setOpen(true)} aria-label={title} title={title}>
        <Bot size={20} />
        <span>{title}</span>
      </button>
    )}

    {open && <aside className="dan-ai-panel" aria-label={title}>
      <header className="dan-ai-header">
        <div>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close AI panel"><X size={18} /></button>
      </header>

      <div className="dan-ai-messages" aria-live="polite">
        {!messages.length && <div className="dan-ai-welcome">
          <ShieldAlert size={28} />
          <strong>AI insight ready</strong>
          <p>{subtitle}</p>
          <div className="dan-ai-suggestions">{defaultSuggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void ask(suggestion)}>{suggestion}</button>)}</div>
        </div>}

        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`dan-ai-message ${message.role}`}><span>{message.content}</span></div>)}
        {loading && <div className="dan-ai-message assistant"><span className="dan-ai-typing">DAN T AI is checking...</span></div>}
        {error && <div className="dan-ai-error"><span>{error}</span><button type="button" onClick={() => void ask(input || defaultSuggestions[0])}>Retry</button></div>}
      </div>

      <form className="dan-ai-form" onSubmit={submit}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Ask ${title}...`} aria-label={`Ask ${title}`} maxLength={1200} />
        <button type="submit" disabled={loading || !input.trim()} aria-label="Send question"><Send size={17} /></button>
      </form>
    </aside>}
  </>);
}
