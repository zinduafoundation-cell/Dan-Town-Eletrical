export type CustomerNotificationPreferences = {
  inbox_enabled: boolean;
  transactional_email: boolean;
  marketing_email: boolean;
  push_enabled: boolean;
  push_marketing: boolean;
  promotions_opt_in: boolean;
  products_opt_in: boolean;
  back_in_stock_enabled: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
  timezone: string;
  promotions_consent_at: string | null;
  promotions_consent_source: string | null;
  products_consent_at: string | null;
  products_consent_source: string | null;
};

export const defaultCustomerNotificationPreferences: CustomerNotificationPreferences = {
  inbox_enabled: true,
  transactional_email: true,
  marketing_email: false,
  push_enabled: false,
  push_marketing: false,
  promotions_opt_in: false,
  products_opt_in: false,
  back_in_stock_enabled: true,
  quiet_start: null,
  quiet_end: null,
  timezone: "Africa/Nairobi",
  promotions_consent_at: null,
  promotions_consent_source: null,
  products_consent_at: null,
  products_consent_source: null,
};
