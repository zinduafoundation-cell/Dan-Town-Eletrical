import { z } from "zod";

import { AppError } from "../core/errors";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type ApprovedContext = { tool: string; data: unknown };

type ResponsesFunctionCall = {
  type?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
};

type ResponsesMessage = {
  type?: string;
  content?: Array<{ type?: string; text?: string }>;
};

type ResponsesPayload = {
  output?: Array<ResponsesFunctionCall | ResponsesMessage>;
  output_text?: string;
};

export type ControlledAiResult = {
  answer: string;
  toolResult: ApprovedContext | null;
  provider: "responses" | "legacy-compatible";
};

const approvedContextArguments = z.object({ query: z.string().trim().min(1).max(1200) }).strict();

const approvedContextTool = {
  type: "function",
  name: "get_approved_dantown_context",
  description: "Retrieve current Dantown information for the user's question. This tool is read-only, permission-filtered by the server, and must be used before stating any Dantown operational fact, price, availability, order state, payment state, or business metric.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "The user's Dantown question, reproduced without adding a new request." },
    },
    required: ["query"],
    additionalProperties: false,
  },
} as const;

function getResponsesEndpoint() {
  if (process.env.OPENAI_RESPONSES_BASE_URL) return process.env.OPENAI_RESPONSES_BASE_URL;
  if (process.env.AI_PROVIDER_BASE_URL) return null;
  return "https://api.openai.com/v1/responses";
}

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError("DATABASE_ERROR", "DAN T AI is not configured yet.", 503);
  return apiKey;
}

async function requestResponses(body: Record<string, unknown>) {
  const response = await fetch(getResponsesEndpoint()!, {
    method: "POST",
    headers: { Authorization: `Bearer ${getApiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new AppError("NETWORK_ERROR", "DAN T AI is temporarily unavailable.", 503);
  return response.json() as Promise<ResponsesPayload>;
}

function getOutputText(response: ResponsesPayload) {
  if (response.output_text?.trim()) return response.output_text.trim();
  return (response.output ?? [])
    .filter((item): item is ResponsesMessage => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function getApprovedContextCall(response: ResponsesPayload) {
  return (response.output ?? []).find(
    (item): item is ResponsesFunctionCall =>
      item.type === "function_call" && "name" in item && item.name === approvedContextTool.name,
  );
}

export async function completeWithProvider(messages: ChatMessage[]) {
  const response = await fetch(process.env.AI_PROVIDER_BASE_URL || "https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${getApiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", temperature: 0.2, messages }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new AppError("NETWORK_ERROR", "DAN T AI is temporarily unavailable.", 503);
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) throw new AppError("NETWORK_ERROR", "DAN T AI returned an empty response.", 503);
  return content;
}

export async function completeWithApprovedContext({
  system,
  history,
  question,
  resolveApprovedContext,
}: {
  system: string;
  history: ChatMessage[];
  question: string;
  resolveApprovedContext: () => Promise<ApprovedContext>;
}): Promise<ControlledAiResult> {
  const messages: ChatMessage[] = [{ role: "system", content: system }, ...history, { role: "user", content: question }];

  if (!getResponsesEndpoint()) {
    const toolResult = await resolveApprovedContext();
    return {
      answer: await completeWithProvider([
        ...messages,
        { role: "user", content: `Approved read-only data from ${toolResult.tool}: ${JSON.stringify(toolResult.data)}` },
      ]),
      toolResult,
      provider: "legacy-compatible",
    };
  }

  const firstResponse = await requestResponses({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    instructions: system,
    input: [...history, { role: "user", content: question }],
    tools: [approvedContextTool],
    tool_choice: "required",
    parallel_tool_calls: false,
    temperature: 0.2,
  });
  const toolCall = getApprovedContextCall(firstResponse);

  if (!toolCall) {
    return {
      answer: getOutputText(firstResponse) || "I cannot verify that from approved business data right now.",
      toolResult: null,
      provider: "responses",
    };
  }

  const parsedArguments = approvedContextArguments.safeParse(JSON.parse(toolCall.arguments ?? "{}"));
  if (!parsedArguments.success || !toolCall.call_id) {
    throw new AppError("NETWORK_ERROR", "DAN T AI returned an invalid data request.", 503);
  }

  // Use the original user question so a model-generated tool argument cannot
  // expand the caller's authorized data scope.
  const toolResult = await resolveApprovedContext();
  const secondResponse = await requestResponses({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    instructions: system,
    input: [
      ...history,
      { role: "user", content: question },
      ...(firstResponse.output ?? []),
      {
        type: "function_call_output",
        call_id: toolCall.call_id,
        output: JSON.stringify({ tool: toolResult.tool, data: toolResult.data }),
      },
    ],
    tools: [approvedContextTool],
    tool_choice: "none",
    parallel_tool_calls: false,
    temperature: 0.2,
  });

  return {
    answer: getOutputText(secondResponse) || "I could not turn the approved data into an answer right now.",
    toolResult,
    provider: "responses",
  };
}
