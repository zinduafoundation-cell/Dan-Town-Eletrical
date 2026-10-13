import { z } from "zod";

export const businessDocumentSettingsSchema = z.object({
  businessName: z.string().trim().min(1).max(100),
  address: z.string().trim().max(200),
  phone: z.string().trim().max(40),
  email: z.string().trim().email().max(254).or(z.literal("")),
  logoUrl: z.string().trim().max(500).url().refine((value) => value.startsWith("https://"), "Logo URL must use HTTPS.").or(z.literal("")),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  footer: z.string().trim().max(300),
  showCustomer: z.boolean(),
  showItemSkus: z.boolean(),
  showTax: z.boolean(),
  showPaymentMethod: z.boolean(),
});

export type BusinessDocumentSettings = z.infer<typeof businessDocumentSettingsSchema>;

export const defaultBusinessDocumentSettings: BusinessDocumentSettings = {
  businessName: "Dantown Electrical",
  address: "Kitale, Kenya",
  phone: "",
  email: "info@dantown.co.ke",
  logoUrl: "",
  accentColor: "#f58220",
  footer: "Thank you for choosing Dantown Electrical.",
  showCustomer: true,
  showItemSkus: true,
  showTax: true,
  showPaymentMethod: true,
};
