import { AppError } from "../core/errors";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function completeWithProvider(messages: ChatMessage[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError("DATABASE_ERROR", "DAN T AI is not configured yet.", 503);

  const response = await fetch(process.env.AI_PROVIDER_BASE_URL || "https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", temperature: 0.2, messages })
  });
  if (!response.ok) throw new AppError("NETWORK_ERROR", "DAN T AI is temporarily unavailable.", 503, await response.text());
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) throw new AppError("NETWORK_ERROR", "DAN T AI returned an empty response.", 503);
  return content;
}