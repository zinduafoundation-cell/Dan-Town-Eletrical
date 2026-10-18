export const aiEditableBusinessSettings = [
  "businessName",
  "businessCode",
  "phone",
  "email",
  "address",
  "branchName",
  "country",
  "timeZone",
  "dateLocale",
] as const;

export type AiEditableBusinessSetting = typeof aiEditableBusinessSettings[number];

const settingLabels: Record<AiEditableBusinessSetting, string> = {
  businessName: "business name",
  businessCode: "business code",
  phone: "business phone",
  email: "business email",
  address: "business address",
  branchName: "branch name",
  country: "country",
  timeZone: "time zone",
  dateLocale: "date format",
};

const settingAliases: Record<string, AiEditableBusinessSetting> = {
  "business name": "businessName",
  "business code": "businessCode",
  "business phone": "phone",
  phone: "phone",
  "business email": "email",
  email: "email",
  "business address": "address",
  address: "address",
  "branch name": "branchName",
  country: "country",
  timezone: "timeZone",
  "time zone": "timeZone",
  "date format": "dateLocale",
  "date locale": "dateLocale",
};

const updatePattern = /^\s*(?:please\s+)?(?:change|update|set)\s+(?:the\s+)?(business name|business code|business phone|phone|business email|email|business address|address|branch name|country|timezone|time zone|date format|date locale)\s+(?:to|as)\s+(.+?)\s*[.!?]*\s*$/i;

export function parseAiBusinessSettingChange(message: string) {
  const match = updatePattern.exec(message);
  if (!match) return null;
  const field = settingAliases[match[1].toLowerCase()];
  const value = match[2].trim();
  if (!field || !value) return null;
  return { field, value, label: settingLabels[field] };
}
