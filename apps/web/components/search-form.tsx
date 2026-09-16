"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type SearchSuggestion = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  category: string | null;
};

const RECENT_SEARCHES_KEY = "dantown-recent-searches";

export function SearchForm({
  initialValue = "",
  className = "search-form"
}: {
  initialValue?: string;
  className?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(RECENT_SEARCHES_KEY);
        if (saved) setRecentSearches(JSON.parse(saved) as string[]);
      } catch {
        setRecentSearches([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) {
      const reset = window.setTimeout(() => setSuggestions([]), 0);
      return () => window.clearTimeout(reset);
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const response = await fetch(`/api/catalog/search?q=${encodeURIComponent(term)}`, {
        signal: controller.signal
      });
      if (!response.ok) return;
      const data = (await response.json()) as { products?: SearchSuggestion[] };
      setSuggestions(data.products ?? []);
      setOpen(true);
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [value]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function rememberSearch() {
    const term = value.trim();
    if (!term) return;
    const next = [term, ...recentSearches.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 5);
    setRecentSearches(next);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  }

  return (
    <div className="search-autocomplete" ref={containerRef}>
      <form action="/search" className={className} method="get" onSubmit={rememberSearch}>
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search products, brands, cables, solar equipment..."
          aria-label="Search products, brands, categories or SKU"
          autoComplete="off"
          aria-controls="search-suggestions"
        />
        <button type="submit">Search</button>
      </form>

      {open && (suggestions.length > 0 || (value.trim().length < 2 && recentSearches.length > 0)) ? (
        <div className="search-suggestions" id="search-suggestions" role="listbox">
          {suggestions.length > 0 ? suggestions.map((product) => (
            <Link
              href={`/products/${product.slug}`}
              key={product.id}
              className="search-suggestion"
              onClick={() => setOpen(false)}
              role="option"
            >
              <span>
                <strong>{product.name}</strong>
                <small>{product.category ?? product.sku}</small>
              </span>
              <b>KES {product.price.toLocaleString("en-KE")}</b>
            </Link>
          )) : (
            <>
              <small className="search-suggestions-label">Recent searches</small>
              {recentSearches.map((search) => (
                <Link href={`/search?q=${encodeURIComponent(search)}`} key={search} className="search-suggestion recent">
                  <span>{search}</span>
                </Link>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
