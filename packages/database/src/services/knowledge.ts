import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, AiKnowledgeEntry } from "../types";

export async function getPublishedKnowledge(client: SupabaseClient<Database>, query: string, limit = 5) {
  const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 2).slice(0, 8);
  let request = client.from("ai_knowledge_entries").select("*").eq("status", "PUBLISHED");
  if (terms.length) request = request.or(terms.map((term) => `title.ilike.%${term}%,content.ilike.%${term}%,category.ilike.%${term}%`).join(","));
  const { data, error } = await request.order("updated_at", { ascending: false }).limit(limit * 3);
  if (error) return { entries: [] as AiKnowledgeEntry[], error };
  const normalizedQuery = query.toLowerCase();
  const entries = selectPublishedKnowledge(data ?? [], normalizedQuery, limit);
  return { entries, error: null };
}

export function selectPublishedKnowledge(entries: AiKnowledgeEntry[], query: string, limit = 5) {
  return entries.filter((entry) => entry.status === "PUBLISHED" && score(entry, query) > 0).sort((left, right) => score(right, query) - score(left, query)).slice(0, limit);
}

function score(entry: AiKnowledgeEntry, query: string) {
  const text = `${entry.title} ${entry.category} ${entry.content}`.toLowerCase();
  return query.split(/\s+/).filter((term) => term.length > 2 && text.includes(term)).length;
}