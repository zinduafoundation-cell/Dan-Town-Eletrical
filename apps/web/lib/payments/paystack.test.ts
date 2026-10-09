import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaystackClient, PaystackApiError } from "./paystack";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Paystack client", () => {
  it("initializes a transaction using the server-side secret", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        status: true,
        data: {
          authorization_url: "https://checkout.paystack.com/example",
          access_code: "access-code",
          reference: "transaction-reference"
        }
      }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPaystackClient("sk_test_server_only").transaction.initialize({
      email: "buyer@example.com",
      amount: 25000,
      callback_url: "https://example.com/callback",
      metadata: { order_id: "1b9eb5dc-1aac-4655-a4a4-2f0a2628fc31", customer_name: "Buyer" }
    });

    expect(result.reference).toBe("transaction-reference");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.paystack.co/transaction/initialize");
    expect(options?.headers).toMatchObject({ Authorization: "Bearer sk_test_server_only" });
    expect(JSON.parse(String(options?.body))).toMatchObject({ amount: 25000 });
  });

  it("URL-encodes the reference when verifying a transaction", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        status: true,
        data: {
          amount: 25000,
          status: "success",
          reference: "transaction/reference",
          currency: "KES",
          metadata: { order_id: "1b9eb5dc-1aac-4655-a4a4-2f0a2628fc31" }
        }
      }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPaystackClient("sk_test_server_only")
      .transaction.verify("transaction/reference");

    expect(result.status).toBe("success");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.paystack.co/transaction/verify/transaction%2Freference"
    );
  });

  it("rejects invalid configuration, amounts, and malformed provider responses", async () => {
    expect(() => createPaystackClient(undefined)).toThrow(PaystackApiError);

    const client = createPaystackClient("sk_test_server_only");
    expect(() => client.transaction.initialize({
      email: "buyer@example.com",
      amount: 0,
      callback_url: "https://example.com/callback",
      metadata: { order_id: "1b9eb5dc-1aac-4655-a4a4-2f0a2628fc31", customer_name: "Buyer" }
    })).toThrow("positive integer");

    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(
      new Response("<!DOCTYPE html>not JSON", { status: 502 })
    ));
    await expect(client.transaction.verify("reference"))
      .rejects.toThrow("invalid response");
  });
});
