import { describe, expect, it } from "vitest";
import { businessDocumentSettingsSchema, defaultBusinessDocumentSettings } from "./business-document-settings";

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
});
