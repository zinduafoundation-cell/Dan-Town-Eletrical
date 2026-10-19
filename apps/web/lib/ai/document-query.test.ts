import { describe, expect, it } from "vitest";
import { extractEntitySearchTerm, extractQuoteNumber, formatDateInTimeZone, requestedDocumentTypes } from "./document-query";

describe("AI document query helpers", () => {
  it("filters plural invoice searches to invoice records", () => {
    expect(requestedDocumentTypes("Show overdue invoices")).toEqual(["INVOICE", "SUPPLIER_INVOICE"]);
    expect(requestedDocumentTypes("Find receipt DT-REC-2026-0001")).toEqual(["RECEIPT"]);
    expect(requestedDocumentTypes("Search business documents")).toBeNull();
  });

  it("calculates the current date in the configured business timezone", () => {
    expect(formatDateInTimeZone(new Date("2026-10-19T22:00:00.000Z"), "Africa/Nairobi")).toBe("2026-10-20");
  });

  it("extracts only a safe entity name from AI search requests", () => {
    expect(extractEntitySearchTerm("Find customer Jane Doe", "customer")).toBe("Jane Doe");
    expect(extractEntitySearchTerm("Search suppliers called East Africa Power", "supplier")).toBe("East Africa Power");
    expect(extractEntitySearchTerm("Find customer %_Jane", "customer")).toBe("Jane");
  });

  it("only extracts an explicit quotation number", () => {
    expect(extractQuoteNumber("Find pending quotation DT-Q-2026-1001")).toBe("DT-Q-2026-1001");
    expect(extractQuoteNumber("Find quote QT20261001")).toBe("QT20261001");
    expect(extractQuoteNumber("Show my recent quotations")).toBeNull();
  });
});
