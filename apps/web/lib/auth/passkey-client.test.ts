import { describe, expect, it } from "vitest";
import { readPasskeyResponse } from "./passkey-client";

describe("passkey API responses", () => {
  it("reads successful JSON responses", async () => {
    const result = await readPasskeyResponse<{ ok: boolean }>(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(result).toEqual({ ok: true });
  });

  it("reports an outdated deployment instead of exposing an HTML parse error", async () => {
    const response = new Response("<!DOCTYPE html><html>Not found</html>", {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });

    await expect(readPasskeyResponse(response)).rejects.toThrow(
      "This app version does not have the biometric sign-in service.",
    );
  });

  it("rejects malformed JSON with a readable error", async () => {
    const response = new Response("{", {
      headers: { "Content-Type": "application/json" },
    });

    await expect(readPasskeyResponse(response)).rejects.toThrow(
      "The biometric sign-in service returned invalid data.",
    );
  });
});
