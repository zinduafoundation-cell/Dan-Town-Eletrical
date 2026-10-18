import { beforeEach, describe, expect, it, vi } from "vitest";

const saveOfflinePOSProducts = vi.fn();

vi.mock("@/lib/centre/offline-storage", () => ({
  saveOfflinePOSProducts,
}));

const { downloadOfflinePOSCatalogue } = await import("./offline-catalogue");

describe("downloadOfflinePOSCatalogue", () => {
  beforeEach(() => {
    saveOfflinePOSProducts.mockReset();
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true },
      configurable: true,
      writable: true,
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("keeps the sync robust when the server omits the row count", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [{ id: "1", name: "Lamp", sku: "LAMP-1", barcode: null, description: null, price: 150, vatRate: 16, category: "Lighting", qty: 5, imageUrl: null }],
      }),
    } as Response);

    await expect(downloadOfflinePOSCatalogue()).resolves.toBe(1);
    expect(saveOfflinePOSProducts).toHaveBeenCalledWith(
      [
        { id: "1", name: "Lamp", sku: "LAMP-1", barcode: null, description: null, price: 150, vatRate: 16, category: "Lighting", qty: 5, imageUrl: null },
      ],
      1,
      true,
    );
  });

  it("still paginates when the total count is present", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: Array.from({ length: 100 }, (_, index) => ({
            id: `lamp-${index}`,
            name: `Lamp ${index}`,
            sku: `LAMP-${index}`,
            barcode: null,
            description: null,
            price: 150,
            vatRate: 16,
            category: "Lighting",
            qty: 5,
            imageUrl: null,
          })),
          count: 101,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: "lamp-100", name: "Lamp 100", sku: "LAMP-100", barcode: null, description: null, price: 150, vatRate: 16, category: "Lighting", qty: 5, imageUrl: null }],
        }),
      } as Response);

    await expect(downloadOfflinePOSCatalogue()).resolves.toBe(101);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(saveOfflinePOSProducts).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "lamp-0" }),
        expect.objectContaining({ id: "lamp-100" }),
      ]),
      101,
      true,
    );
  });
});
