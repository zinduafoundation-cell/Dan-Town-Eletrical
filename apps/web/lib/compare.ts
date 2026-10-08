"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "dantown-compare";
const EVENT = "dantown:compare-changed";
export const MAX_COMPARE = 4;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

function write(slugs: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(slugs.slice(0, MAX_COMPARE)));
  } catch {
    // storage unavailable (private mode): comparison just won't persist
  }
  window.dispatchEvent(new Event(EVENT));
}

/** The shopper's compare list (up to 4 product slugs), shared across the whole site. */
export function useCompare() {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setSlugs(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((slug: string) => {
    const current = read();
    if (current.includes(slug)) { write(current.filter((item) => item !== slug)); return true; }
    if (current.length >= MAX_COMPARE) return false;
    write([...current, slug]);
    return true;
  }, []);
  const remove = useCallback((slug: string) => write(read().filter((item) => item !== slug)), []);
  const clear = useCallback(() => write([]), []);

  return { slugs, toggle, remove, clear, isFull: slugs.length >= MAX_COMPARE };
}
