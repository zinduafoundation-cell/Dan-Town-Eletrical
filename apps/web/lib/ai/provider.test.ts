import { afterEach, describe, expect, it, vi } from "vitest";

import { completeWithApprovedContext } from "./provider";

const originalApiKey = process.env.OPENAI_API_KEY;
const originalProviderBaseUrl = process.env.AI_PROVIDER_BASE_URL;

afterEach(() => {
  process.env.OPENAI_API_KEY = originalApiKey;
  if (originalProviderBaseUrl === undefined) delete process.env.AI_PROVIDER_BASE_URL;
  else process.env.AI_PROVIDER_BASE_URL = originalProviderBaseUrl;
  vi.unstubAllGlobals();
});

describe("controlled DAN T AI provider", () => {
  it("requires a strict approved-context call before returning an answer", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.AI_PROVIDER_BASE_URL;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        output: [{ type: "function_call", name: "get_approved_dantown_context", call_id: "call_1", arguments: '{"query":"show sales"}' }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: "Today's approved sales summary is ready." }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const resolveApprovedContext = vi.fn().mockResolvedValue({ tool: "getBusinessSummary", data: { totalOrders: 2 } });
    const result = await completeWithApprovedContext({
      system: "Use only approved context.",
      history: [],
      question: "Show sales",
      resolveApprovedContext,
    });

    expect(result).toEqual({
      answer: "Today's approved sales summary is ready.",
      toolResult: { tool: "getBusinessSummary", data: { totalOrders: 2 } },
      provider: "responses",
    });
    expect(resolveApprovedContext).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(firstBody.tool_choice).toBe("required");
    expect(firstBody.tools[0]).toMatchObject({
      name: "get_approved_dantown_context",
      strict: true,
      parameters: { additionalProperties: false, required: ["query"] },
    });
  });

  it("keeps a legacy-compatible provider behind the same server-approved context boundary", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.AI_PROVIDER_BASE_URL = "https://provider.example.test/chat";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "Approved answer." } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const resolveApprovedContext = vi.fn().mockResolvedValue({ tool: "getCategories", data: [] });
    const result = await completeWithApprovedContext({
      system: "Use only approved context.",
      history: [],
      question: "List categories",
      resolveApprovedContext,
    });

    expect(result.provider).toBe("legacy-compatible");
    expect(result.toolResult?.tool).toBe("getCategories");
    expect(resolveApprovedContext).toHaveBeenCalledOnce();
  });
});
