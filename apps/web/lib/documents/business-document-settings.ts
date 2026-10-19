import { z } from "zod";
import { defaultDocumentPrefixes } from "./business-document-types";

const businessDayHoursSchema = z.object({
  open: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  close: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  closed: z.boolean(),
});

export const defaultBusinessHours = {
  monday: { open: "08:00", close: "18:00", closed: false },
  tuesday: { open: "08:00", close: "18:00", closed: false },
  wednesday: { open: "08:00", close: "18:00", closed: false },
  thursday: { open: "08:00", close: "18:00", closed: false },
  friday: { open: "08:00", close: "18:00", closed: false },
  saturday: { open: "08:30", close: "17:00", closed: false },
  sunday: { open: "08:00", close: "18:00", closed: true },
} as const;

const businessDocumentSettingsInputSchema = z.object({
  businessName: z.string().trim().min(1).max(100),
  businessCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,8}$/).default("DT"),
  financialYearStartMonth: z.number().int().min(1).max(12).default(1),
  country: z.string().trim().min(1).max(80).default("Kenya"),
  timeZone: z.string().trim().min(1).max(64).default("Africa/Nairobi").refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid time zone."),
  dateLocale: z.enum(["en-KE", "en-GB", "en-US"]).default("en-KE"),
  paperSize: z.enum(["A4", "A5", "LETTER"]).default("A4"),
  branchName: z.string().trim().max(100).default(""),
  registrationNumber: z.string().trim().max(80).default(""),
  openingHours: z.object({
    monday: businessDayHoursSchema,
    tuesday: businessDayHoursSchema,
    wednesday: businessDayHoursSchema,
    thursday: businessDayHoursSchema,
    friday: businessDayHoursSchema,
    saturday: businessDayHoursSchema,
    sunday: businessDayHoursSchema,
  }).default(defaultBusinessHours),
  documentPrefixes: z.record(z.string(), z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,8}$/)).default({}),
  address: z.string().trim().max(200),
  phone: z.string().trim().max(40),
  email: z.string().trim().email().max(254).or(z.literal("")),
  logoUrl: z.string().trim().max(500).url().refine((value) => value.startsWith("https://"), "Logo URL must use HTTPS.").or(z.literal("")),
  kraPin: z.string().trim().max(24).default(""),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  footer: z.string().trim().max(300),
  showCustomer: z.boolean(),
  showItemSkus: z.boolean(),
  showTax: z.boolean(),
  showPaymentMethod: z.boolean(),
});

export const businessDocumentSettingsSchema = businessDocumentSettingsInputSchema
  .transform((settings) => ({
    ...settings,
    documentPrefixes: { ...defaultDocumentPrefixes, ...settings.documentPrefixes },
  }))
  .superRefine((settings, context) => {
    const seen = new Set<string>();
    for (const [documentType, prefix] of Object.entries(settings.documentPrefixes)) {
      if (!(documentType in defaultDocumentPrefixes)) {
        context.addIssue({ code: "custom", path: ["documentPrefixes", documentType], message: "Choose a registered document type." });
      }
      if (seen.has(prefix)) {
        context.addIssue({ code: "custom", path: ["documentPrefixes", documentType], message: "Each document type must use a unique number prefix." });
      }
      seen.add(prefix);
    }
  });

export type BusinessDocumentSettings = z.infer<typeof businessDocumentSettingsSchema>;

export const defaultBusinessDocumentSettings: BusinessDocumentSettings = {
  businessName: "Dantown Electrical",
  businessCode: "DT",
  financialYearStartMonth: 1,
  country: "Kenya",
  timeZone: "Africa/Nairobi",
  dateLocale: "en-KE",
  paperSize: "A4",
  branchName: "",
  registrationNumber: "",
  openingHours: defaultBusinessHours,
  documentPrefixes: defaultDocumentPrefixes,
  address: "Kitale, Kenya",
  phone: "",
  email: "info@dantown.co.ke",
  logoUrl: "",
  kraPin: "",
  accentColor: "#f58220",
  footer: "Thank you for choosing Dantown Electrical.",
  showCustomer: true,
  showItemSkus: true,
  showTax: true,
  showPaymentMethod: true,
};

export function formatBusinessDocumentDate(value: string | Date, settings: BusinessDocumentSettings) {
  const inputDate = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00.000Z`)
    : new Date(value);
  if (Number.isNaN(inputDate.getTime())) throw new Error("Document date is invalid.");
  return new Intl.DateTimeFormat(settings.dateLocale, {
    dateStyle: "medium",
    timeZone: settings.timeZone,
  }).format(inputDate);
}

export function formatBusinessTime(value: string, settings: BusinessDocumentSettings) {
  const [hour, minute] = value.split(":").map(Number);
  const time = new Date(Date.UTC(2026, 0, 1, hour, minute));
  return new Intl.DateTimeFormat(settings.dateLocale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(time);
}
