import "server-only";

import { z } from "zod";

const parsedItemSchema = z.object({
  requestedName: z.string().trim().min(2).max(180),
  brand: z.string().trim().max(80).nullable().optional(),
  model: z.string().trim().max(100).nullable().optional(),
  specifications: z.record(z.string(), z.string()).default({}),
  quantity: z.number().int().min(1).max(100_000).default(1),
  unit: z.string().trim().max(30).default("unit"),
});

export type ParsedQuotationItem = z.infer<typeof parsedItemSchema>;

const outputSchema = z.object({
  items: z.array(parsedItemSchema).max(25),
});

function extractText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as {
    output_text?: string;
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  const choicesContent = response.choices?.[0]?.message?.content;
  if (typeof choicesContent === "string") return choicesContent;
  if (Array.isArray(choicesContent)) return choicesContent.map((part) => part.text ?? "").join("\n");
  if (response.output_text) return response.output_text;
  return (response.output ?? []).flatMap((item) => item.content ?? []).map((part) => part.text ?? "").join("\n");
}

function parseOutput(text: string) {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new Error("The file could not be read confidently. Try a clearer photo showing product names, quantities and specifications.");
  }
  const parsed = outputSchema.safeParse(decoded);
  if (!parsed.success || !parsed.data.items.length) {
    throw new Error("No readable product line items were found. Try a clearer quotation or product photo.");
  }
  return parsed.data.items;
}

async function parseWithResponses(file: File, kind: "quotation" | "product", apiKey: string) {
  const prompt = kind === "quotation"
    ? "Read this quotation and return JSON only: {\"items\":[{\"requestedName\":\"...\",\"brand\":null,\"model\":null,\"specifications\":{},\"quantity\":1,\"unit\":\"unit\"}]}. Include only readable product line items. Do not invent details. For a product photo, identify it cautiously as one item with quantity 1."
    : "Identify the product in this image and return JSON only: {\"items\":[{\"requestedName\":\"...\",\"brand\":null,\"model\":null,\"specifications\":{},\"quantity\":1,\"unit\":\"unit\"}]}. Use cautious wording, only include visible details, and do not invent missing details.";
  const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
  const content = file.type === "application/pdf"
    ? [{ type: "input_text", text: prompt }, { type: "input_file", filename: "quotation.pdf", file_data: `data:application/pdf;base64,${bytes}` }]
    : [{ type: "input_text", text: prompt }, { type: "input_image", image_url: `data:${file.type};base64,${bytes}`, detail: "high" }];
  const response = await fetch(process.env.OPENAI_RESPONSES_BASE_URL || "https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: [{ role: "user", content }],
      text: { format: { type: "json_object" } },
      temperature: 0,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok) {
    console.error("Smart Match AI provider rejected a document scan:", response.status);
    throw new Error("The scan service is temporarily unavailable. Please try again or use manual search.");
  }
  return parseOutput(extractText(await response.json()));
}

async function parseWithChatCompletions(file: File, kind: "quotation" | "product", apiKey: string) {
  if (file.type === "application/pdf") {
    throw new Error("PDF scanning is not supported by the currently configured AI provider. Upload an image of the quotation or search manually.");
  }
  const baseUrl = process.env.AI_PROVIDER_BASE_URL;
  if (!baseUrl) throw new Error("Smart Match AI is not configured.");
  const prompt = kind === "quotation"
    ? "Read this quotation and return JSON only: {\"items\":[{\"requestedName\":\"...\",\"brand\":null,\"model\":null,\"specifications\":{},\"quantity\":1,\"unit\":\"unit\"}]}. Include only clearly readable line items. Do not invent details."
    : "Identify the visible product and return JSON only: {\"items\":[{\"requestedName\":\"...\",\"brand\":null,\"model\":null,\"specifications\":{},\"quantity\":1,\"unit\":\"unit\"}]}. Be cautious and do not invent details.";
  const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:${file.type};base64,${bytes}` } }] }],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok) {
    console.error("Smart Match compatible AI provider rejected an image scan:", response.status);
    throw new Error("The scan service is temporarily unavailable. Please try again or use manual search.");
  }
  return parseOutput(extractText(await response.json()));
}

export async function parseSmartMatchFile(file: File, kind: "quotation" | "product") {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Smart scanning is not configured yet. Please use manual product search.");
  return process.env.AI_PROVIDER_BASE_URL
    ? parseWithChatCompletions(file, kind, apiKey)
    : parseWithResponses(file, kind, apiKey);
}
