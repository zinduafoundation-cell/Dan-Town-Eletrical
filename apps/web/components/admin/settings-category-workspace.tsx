"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Search } from "lucide-react";
import type { Permission } from "@dantown/shared";
import type { SettingsCategory } from "@/lib/settings/categories";

export function SettingsCategoryWorkspace({
  category,
  permissions,
}: {
  category: SettingsCategory;
  permissions: Permission[];
}) {
  const [query, setQuery] = useState("");
  const links = useMemo(() => category.links.filter((link) =>
    (!link.permission || permissions.includes(link.permission))
    && (!query.trim() || link.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),
  ), [category.links, permissions, query]);

  return (
    <div className="settings-category-workspace">
      <Link href="/admin/settings" className="settings-back-link"><ArrowLeft size={16} /> All settings</Link>
      <section className="settings-category-heading">
        <p className="eyebrow">Settings / {category.title}</p>
        <h2>{category.title}</h2>
        <p>{category.description}</p>
        <strong>{category.status}</strong>
      </section>
      <div className="settings-category-notice">{category.notice}</div>
      <label className="settings-global-search settings-category-search">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Search actions in {category.title}</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${category.title.toLowerCase()} actions...`} />
        {query && <button type="button" onClick={() => setQuery("")}>Clear</button>}
      </label>
      {links.length ? <div className="settings-action-grid">{links.map((link) => <Link className="settings-action-card" href={link.href} key={`${link.href}-${link.label}`}>
        <span><strong>{link.label}</strong><small>Open the authorized workspace that owns this setting or record.</small></span>
        <ArrowUpRight size={18} aria-hidden="true" />
      </Link>)}</div> : <div className="settings-empty"><h3>No available actions</h3><p>Your account does not have permission for this area, or the search did not match an action.</p></div>}
      <p className="settings-confirmation-note">Changes made in linked workspaces use their own validation, confirmation, and audit controls. This page does not save shadow copies of module settings.</p>
      <button className="button button-secondary" type="button" onClick={() => window.dispatchEvent(new CustomEvent("dantown-ai-ask", { detail: `Explain the ${category.title} settings page and guide me to the right control.` }))}>Ask DAN T AI about this page</button>
    </div>
  );
}
