import { describe, expect, it } from "vitest";
import { getBusinessDocumentSourceKind, getBusinessDocumentType } from "./business-document-types";

describe("business document source records", () => {
  it("maps sales documents to existing sales orders", () => {
    for (const type of ["SALES_ORDER", "INVOICE", "CREDIT_NOTE", "DEBIT_NOTE", "SALES_RETURN_FORM", "DELIVERY_NOTE", "DISPATCH_NOTE"] as const) {
      expect(getBusinessDocumentSourceKind(type)).toBe("order");
      expect(getBusinessDocumentType(type)).toBeDefined();
    }
  });

  it("maps supplier documents to existing purchase orders", () => {
    for (const type of ["PURCHASE_ORDER", "SUPPLIER_INVOICE", "GOODS_RECEIVED_NOTE", "PURCHASE_RETURN_FORM"] as const) {
      expect(getBusinessDocumentSourceKind(type)).toBe("purchase_order");
      expect(getBusinessDocumentType(type)).toBeDefined();
    }
  });

  it("leaves independently created documents without a system source mapping", () => {
    expect(getBusinessDocumentSourceKind("QUOTATION")).toBeUndefined();
    expect(getBusinessDocumentSourceKind("OTHER")).toBeUndefined();
  });
});
