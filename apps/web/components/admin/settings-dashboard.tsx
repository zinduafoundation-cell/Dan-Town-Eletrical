"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Bell, Bot, Building2, CreditCard, Database, FileText, Globe2, Package, Search, Settings2, ShoppingCart, Truck, Users } from "lucide-react";
import type { Permission } from "@dantown/shared";
import { searchSettingsCategories } from "@/lib/settings/categories";

const icons = [Building2, FileText, ShoppingCart, Package, Truck, CreditCard, Users, Users, Globe2, Bell, Settings2, Database, Bot];

export function SettingsDashboard({ permissions }: { permissions: Permission[] }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchSettingsCategories(query), [query]);

  return (
    <div className="settings-workspace">
      <section className="settings-search-panel">
        <div>
          <p className="eyebrow">Dantown business controls</p>
          <h2>Settings that connect to real workspaces</h2>
          <p>Search by module or setting. Changes are saved in the module that owns the data, with its existing validation and access controls.</p>
        </div>
        <label className="settings-global-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search settings</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search settings, payments, stock, users..." />
          {query && <button type="button" onClick={() => setQuery("")}>Clear</button>}
        </label>
      </section>
      <p className="settings-access-note">Sensitive administration, payment secrets, and database operations remain restricted. A category only exposes workspaces your account is permitted to use.</p>
      {results.length ? <div className="settings-grid">
        {results.map((category, index) => {
          const Icon = icons[index % icons.length];
          const availableLinks = category.links.filter((link) => !link.permission || permissions.includes(link.permission));
          return <article className="settings-card" key={category.slug}>
            <span className="settings-icon"><Icon size={20} /></span>
            <h2>{category.title}</h2>
            <p>{category.description}</p>
            <small>{category.status}</small>
            <Link href={`/admin/settings/${category.slug}`}>Open settings <ArrowUpRight size={15} /></Link>
            {availableLinks.length === 0 && <span className="settings-card-restricted">Some actions require additional permission.</span>}
          </article>;
        })}
      </div> : <div className="settings-empty"><h3>No matching settings</h3><p>Try a module name such as inventory, documents, or payments.</p></div>}
      <section className="settings-ai-callout">
        <div><p className="eyebrow">DAN T AI</p><h2>Ask about settings</h2><p>Get directions based on approved, permission-filtered information. Authorized Centre and admin users can request supported business-profile changes, which require confirmation before saving. Backups are not available through AI.</p></div>
        <button className="button button-secondary" type="button" onClick={() => window.dispatchEvent(new CustomEvent("dantown-ai-ask", { detail: "Help me find the right Dantown settings page and explain what it controls." }))}>Ask about settings</button>
      </section>
    </div>
  );
}
