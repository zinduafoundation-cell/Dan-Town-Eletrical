"use client";

import { FormEvent, useState } from "react";

type ApprovedAccount = {
  user_id: string;
  email: string;
  approved_at: string;
};

export function BusinessCenterAccessManager({ initialAccounts }: { initialAccounts: ApprovedAccount[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/business-center-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to approve account.");
      setAccounts((current) => [
        { ...result.account, approved_at: new Date().toISOString() },
        ...current.filter((account) => account.user_id !== result.account.user_id)
      ]);
      setEmail("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to approve account.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId: string) {
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/business-center-access", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to remove access.");
      setAccounts((current) => current.filter((account) => account.user_id !== userId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove access.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="content-panel">
      <p>Only the owner and accounts approved here can open Dantown Centre.</p>
      <form className="catalog-simple-fields" onSubmit={submit}>
        <label className="catalog-simple-field catalog-simple-field-wide">
          <span>Account email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="person@example.com"
          />
        </label>
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? "Saving..." : "Approve account"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {accounts.length ? (
        <ul className="portal-list">
          {accounts.map((account) => (
            <li className="portal-list-row" key={account.user_id}>
              <span>
                <strong>{account.email}</strong>
                <small>Approved {new Date(account.approved_at).toLocaleDateString()}</small>
              </span>
              <button
                className="button button-secondary"
                type="button"
                disabled={busy}
                onClick={() => void revoke(account.user_id)}
              >
                Remove access
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No additional accounts are approved.</p>
      )}
    </div>
  );
}
