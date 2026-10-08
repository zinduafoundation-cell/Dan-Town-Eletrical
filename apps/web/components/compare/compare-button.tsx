"use client";

import { GitCompareArrows } from "lucide-react";
import { useState } from "react";
import { MAX_COMPARE, useCompare } from "@/lib/compare";

export function CompareButton({ slug, name }: { slug: string; name: string }) {
  const { slugs, toggle } = useCompare();
  const [hint, setHint] = useState("");
  const active = slugs.includes(slug);

  function onClick() {
    const ok = toggle(slug);
    setHint(ok ? "" : `You can compare up to ${MAX_COMPARE} products`);
    if (!ok) window.setTimeout(() => setHint(""), 2500);
  }

  return (
    <button type="button" className={`product-compare-button${active ? " is-active" : ""}`} onClick={onClick} aria-pressed={active} aria-label={active ? `Remove ${name} from comparison` : `Compare ${name}`} title={hint || (active ? "Remove from comparison" : "Add to comparison")}>
      <GitCompareArrows size={15} /> {hint ? "Max 4" : active ? "Comparing" : "Compare"}
    </button>
  );
}
