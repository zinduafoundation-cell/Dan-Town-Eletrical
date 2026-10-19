import { describe, expect, it } from "vitest";
import { businessDocumentSettingsSchema, defaultBusinessDocumentSettings, formatBusinessDocumentDate } from "./business-document-settings";

describe("shared business document settings", () => {
  it("uses the orange Dantown layout by default", () => {
    expect(defaultBusinessDocumentSettings.accentColor).toBe("#f58220");
    expect(businessDocumentSettingsSchema.safeParse(defaultBusinessDocumentSettings).success).toBe(true);
  });

  it("accepts an HTTPS logo but rejects unsafe protocols and invalid colors", () => {
    expect(businessDocumentSettingsSchema.safeParse({ ...defaultBusinessDocumentSettings, logoUrl: "https://cdn.example.test/logo.png" }).success).toBe(true);
    expect(businessDocumentSettingsSchema.safeParse({ ...defaultBusinessDocumentSettings, logoUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(businessDocumentSettingsSchema.safeParse({ ...defaultBusinessDocumentSettings, accentColor: "purple" }).success).toBe(false);
  });

  it("validates print paper sizes and defaults legacy settings to A4", () => {
    for (const paperSize of ["A4", "A5", "LETTER"] as const) {
      expect(businessDocumentSettingsSchema.safeParse({ ...defaultBusinessDocumentSettings, paperSize }).success).toBe(true);
    }
    expect(businessDocumentSettingsSchema.safeParse({ ...defaultBusinessDocumentSettings, paperSize: "LEGAL" }).success).toBe(false);
    const parsed = businessDocumentSettingsSchema.safeParse({
      businessName: "Dantown Electrical",
      address: "Kitale, Kenya",
      phone: "",
      email: "",
      logoUrl: "",
      accentColor: "#f58220",
      footer: "",
      showCustomer: true,
      showItemSkus: true,
      showTax: true,
      showPaymentMethod: true,
    });
    expect(parsed.success && parsed.data.paperSize).toBe("A4");
  });

  it("keeps legacy settings compatible while applying Kenya-friendly business defaults", () => {
    const parsed = businessDocumentSettingsSchema.safeParse({
      businessName: "Dantown Electrical",
      address: "Kitale, Kenya",
      phone: "",
      email: "",
      logoUrl: "",
      accentColor: "#f58220",
      footer: "",
      showCustomer: true,
      showItemSkus: true,
      showTax: true,
      showPaymentMethod: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.country).toBe("Kenya");
      expect(parsed.data.timeZone).toBe("Africa/Nairobi");
      expect(parsed.data.documentPrefixes.INVOICE).toBe("INV");
    }
  });

  it("rejects invalid or duplicate document prefixes and formats dates using saved locale settings", () => {
    expect(businessDocumentSettingsSchema.safeParse({
      ...defaultBusinessDocumentSettings,
      documentPrefixes: { ...defaultBusinessDocumentSettings.documentPrefixes, INVOICE: "QUO" },
    }).success).toBe(false);
    expect(businessDocumentSettingsSchema.safeParse({
      ...defaultBusinessDocumentSettings,
      documentPrefixes: { ...defaultBusinessDocumentSettings.documentPrefixes, INVOICE: "bad-prefix" },
    }).success).toBe(false);
    expect(formatBusinessDocumentDate("2026-10-18", defaultBusinessDocumentSettings)).toMatch(/18/);
  });
});
