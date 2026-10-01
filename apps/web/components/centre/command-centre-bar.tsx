"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, Command, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import type { CentreCommandResult } from "@/lib/centre/command";

const suggestions = [
  "What needs my attention today?",
  "Show unpaid orders",
  "Find products below minimum stock",
  "Show today's sales",
];

export function CommandCentreBar() {
  const [command, setCommand] = useState("");
  const [result, setResult] = useState<CentreCommandResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(nextCommand: string) {
    const value = nextCommand.trim();
    if (!value || loading) return;

    setCommand(value);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/centre/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: value }),
      });
      const payload = (await response.json()) as {
        data?: CentreCommandResult;
        error?: string;
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "The command could not be completed.");
      }
      setResult(payload.data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The command could not be completed."
      );
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(command);
  }

  return (
    <section className="centre-command" aria-labelledby="centre-command-heading">
      <div className="centre-command-intro">
        <span className="centre-command-icon" aria-hidden="true">
          <Command size={19} />
        </span>
        <div>
          <p className="eyebrow">DAN T AI / Controlled commands</p>
          <h2 id="centre-command-heading">Ask the business, safely.</h2>
          <p>
            Commands only run approved, permission-checked read operations. Changes
            remain in their protected workspaces for review and confirmation.
          </p>
        </div>
        <span className="centre-command-trust">
          <ShieldCheck size={15} /> Permission aware
        </span>
      </div>

      <form className="centre-command-form" onSubmit={submit}>
        <Search aria-hidden="true" size={18} />
        <label className="sr-only" htmlFor="centre-command-input">
          Ask Dantown Centre
        </label>
        <input
          id="centre-command-input"
          maxLength={320}
          onChange={(event) => setCommand(event.target.value)}
          placeholder="Ask about orders, stock, payments, or sales…"
          value={command}
        />
        <button className="button button-primary" disabled={loading || !command.trim()} type="submit">
          {loading ? <LoaderCircle className="centre-command-spinner" size={16} /> : "Run command"}
        </button>
      </form>

      <div className="centre-command-suggestions" aria-label="Suggested commands">
        {suggestions.map((suggestion) => (
          <button key={suggestion} onClick={() => void run(suggestion)} type="button">
            {suggestion}
          </button>
        ))}
      </div>

      {error && <p className="centre-command-error" role="alert">{error}</p>}

      {result && (
        <div className="centre-command-result" role="status">
          <div className="centre-command-result-heading">
            <div>
              <p className="eyebrow">Command result</p>
              <h3>{result.title}</h3>
              <p>{result.summary}</p>
            </div>
            {result.href && result.hrefLabel && (
              <Link className="text-link" href={result.href}>
                {result.hrefLabel} <ArrowRight size={15} />
              </Link>
            )}
          </div>
          {result.items.length > 0 && (
            <div className="centre-command-items">
              {result.items.map((item, index) => (
                <div className={item.tone === "alert" ? "is-alert" : undefined} key={`${item.label}-${index}`}>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
