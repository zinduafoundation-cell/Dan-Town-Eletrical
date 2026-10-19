import type { Permission } from "@dantown/shared";

export type SettingsCategory = {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  status: string;
  notice: string;
  links: Array<{ label: string; href: string; permission?: Permission }>;
};

export const settingsCategories: SettingsCategory[] = [
  {
    slug: "business-profile",
    title: "Business profile",
    description: "Business identity, contacts, location, tax identity, and document branding.",
    keywords: ["business", "profile", "company", "branch", "contact", "address", "country", "timezone", "currency", "logo", "tax"],
    status: "Saved in the shared business document settings",
    notice: "The shared profile is used on business documents, customer receipts, and public opening hours. Currency remains KES in existing transaction schemas; changing it safely requires a coordinated data-model migration.",
    links: [{ label: "Edit business identity and print settings", href: "/admin/settings/documents", permission: "settings.manage" }],
  },
  {
    slug: "documents-and-templates",
    title: "Documents and templates",
    description: "Create, number, search, attach, audit, and print business document records.",
    keywords: ["documents", "invoice", "receipt", "quote", "quotation", "delivery", "purchase order", "template", "numbering", "signature"],
    status: "Live document register and shared print template",
    notice: "Payment receipts are generated from verified paid orders. The document register does not post payments, stock movements, tax returns, or accounting entries.",
    links: [
      { label: "Open Business Documents", href: "/admin/documents", permission: "settings.manage" },
      { label: "Edit shared document template", href: "/admin/settings/documents", permission: "settings.manage" },
      { label: "View confirmed customer orders", href: "/admin/orders", permission: "orders.read" },
    ],
  },
  {
    slug: "sales-and-checkout",
    title: "Sales and checkout",
    description: "Manage orders, quotes, point-of-sale activity, and verified checkout workflows.",
    keywords: ["sales", "checkout", "pos", "orders", "quotes", "discount", "refund", "receipt"],
    status: "Connected to live order and POS workspaces",
    notice: "Checkout providers confirm payment through their existing verification/webhook flows. Payment credentials are server-managed and are never editable or displayed here.",
    links: [
      { label: "Open orders", href: "/admin/orders", permission: "orders.read" },
      { label: "Open point of sale", href: "/pos", permission: "orders.create" },
    ],
  },
  {
    slug: "products-and-inventory",
    title: "Products and inventory",
    description: "Manage catalogue data, product images, warehouses, stock levels, and movements.",
    keywords: ["products", "inventory", "stock", "sku", "barcode", "reorder", "warehouse", "adjustment", "catalogue"],
    status: "Connected to live catalog and inventory records",
    notice: "Stock adjustments and transfers are handled by the audited inventory workflows. A global stock threshold is not added here because the live system stores reorder levels per inventory record.",
    links: [
      { label: "Manage catalogue", href: "/admin/catalog", permission: "products.read" },
      { label: "Manage inventory", href: "/admin/inventory", permission: "inventory.read" },
      { label: "Review stock movements", href: "/admin/inventory/movements", permission: "inventory.read" },
    ],
  },
  {
    slug: "purchases-and-suppliers",
    title: "Purchases and suppliers",
    description: "Work with supplier records, purchase orders, receiving, and procurement.",
    keywords: ["purchases", "suppliers", "procurement", "purchase order", "goods received", "terms"],
    status: "Connected to live purchasing and supplier records",
    notice: "Purchase creation and receiving use their existing transaction workflows; this hub does not create duplicate supplier or purchase settings.",
    links: [
      { label: "Open purchases", href: "/admin/purchases", permission: "inventory.read" },
      { label: "Manage suppliers", href: "/admin/suppliers", permission: "products.read" },
    ],
  },
  {
    slug: "payments-and-finance",
    title: "Payments and finance",
    description: "Review verified payments, refunds, and accounting integration status.",
    keywords: ["payments", "finance", "mpesa", "bank", "cash", "refund", "reconciliation", "quickbooks"],
    status: "Payment verification is active; accounting integration needs configuration",
    notice: "Payment credentials are not stored in editable settings. QuickBooks is currently an unconfigured integration placeholder; no sync is claimed.",
    links: [
      { label: "Review payments", href: "/admin/payments", permission: "payments.read" },
      { label: "View finance reports", href: "/admin/reports", permission: "finance.read" },
      { label: "QuickBooks integration status", href: "/admin/settings/quickbooks", permission: "settings.manage" },
    ],
  },
  {
    slug: "customers-and-crm",
    title: "Customers and CRM",
    description: "Manage customer profiles, contact details, and customer-facing records.",
    keywords: ["customers", "crm", "credit", "contact", "customer accounts"],
    status: "Connected to live customer records",
    notice: "Customer account access is permission-checked by the customer workspace. No credit-limit controls are exposed until they are connected to the order authorization rules.",
    links: [{ label: "Manage customers", href: "/admin/customers", permission: "customers.read" }],
  },
  {
    slug: "users-roles-and-permissions",
    title: "Users, roles, and permissions",
    description: "Manage staff access using the existing role and permission system.",
    keywords: ["users", "roles", "permissions", "team", "cashier", "manager", "accountant", "storekeeper"],
    status: "Live role-based access control",
    notice: "User, role, and permission administration remains protected by the existing BSK-only authorization gate.",
    links: [
      { label: "Open team management", href: "/admin/team", permission: "users.read" },
      { label: "Manage Centre access", href: "/admin/business-center-access", permission: "users.manage" },
    ],
  },
  {
    slug: "website-and-ecommerce",
    title: "Website and ecommerce",
    description: "Manage public catalog content, promotions, and online sales entry points.",
    keywords: ["website", "ecommerce", "storefront", "promotions", "content", "online"],
    status: "Live catalog and promotion management",
    notice: "Online product visibility is driven by the catalog records and publication state, not by duplicate website settings.",
    links: [
      { label: "Manage promotions", href: "/admin/promotions", permission: "promotions.read" },
      { label: "Manage catalog", href: "/admin/catalog", permission: "products.read" },
      { label: "Review online orders", href: "/admin/orders", permission: "orders.read" },
    ],
  },
  {
    slug: "notifications-and-integrations",
    title: "Notifications and integrations",
    description: "Set personal notification preferences and review integration workflows.",
    keywords: ["notifications", "email", "sms", "whatsapp", "integrations", "automation", "n8n", "provider"],
    status: "Notification preferences are saved per signed-in user",
    notice: "Notification delivery depends on server-configured providers. Credentials are never displayed in Settings.",
    links: [
      { label: "Edit my notification preferences", href: "/admin/settings#notifications", permission: "users.read" },
      { label: "Review automation and integrations", href: "/admin/automation", permission: "automation.read" },
    ],
  },
  {
    slug: "reports-and-business-rules",
    title: "Reports and business rules",
    description: "Review operational metrics and reports backed by current business records.",
    keywords: ["reports", "business rules", "analytics", "metrics", "revenue", "performance"],
    status: "Live Centre metrics and reporting workspaces",
    notice: "Financial reports use verified transactions; no accounting ledger or tax filing is implied by a document record.",
    links: [
      { label: "Open Dantown Centre", href: "/centre", permission: "reports.read" },
      { label: "Open business reports", href: "/admin/reports", permission: "reports.read" },
    ],
  },
  {
    slug: "system-database-backups-and-offline",
    title: "System, database, backups, and offline mode",
    description: "Review operational system controls, audit history, and existing offline behavior.",
    keywords: ["system", "database", "backup", "restore", "offline", "audit", "health"],
    status: "Offline POS sync exists; in-app backup and restore are not configured",
    notice: "This application has no verified backup/restore service or database-management credential. Do not treat a Settings action as a backup until the Supabase backup service and restore runbook are configured.",
    links: [
      { label: "Review audit history", href: "/admin/audit-logs", permission: "audit_logs.read" },
      { label: "Review system operations", href: "/admin", permission: "users.read" },
    ],
  },
  {
    slug: "ai-assistant",
    title: "AI assistant configuration",
    description: "Review AI knowledge, availability, and safe business-data assistance.",
    keywords: ["ai", "assistant", "openai", "model", "knowledge", "tools", "configuration"],
    status: "AI uses permission-filtered business data and confirmed profile updates",
    notice: "The AI provider key and model are server environment settings. It can update supported business-profile fields only after confirmation and authorization; it cannot create backups or restore data.",
    links: [
      { label: "Manage approved AI knowledge", href: "/admin/knowledge", permission: "settings.manage" },
      { label: "Check AI configuration", href: "/admin/ai/smart-match", permission: "products.read" },
    ],
  },
];

export function findSettingsCategory(slug: string) {
  return settingsCategories.find((category) => category.slug === slug);
}

export function searchSettingsCategories(query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return settingsCategories;
  const ignored = new Set(["about", "controls", "current", "dantown", "explain", "find", "guide", "help", "how", "me", "page", "right", "settings", "the", "this", "what", "where", "with"]);
  const terms = normalized.split(/[^a-z0-9]+/).filter((term) => term.length > 2 && !ignored.has(term));
  if (!terms.length) return settingsCategories;
  return settingsCategories.filter((category) => {
    const searchable = [
      category.title,
      category.description,
      category.status,
      ...category.keywords,
      ...category.links.map((link) => link.label),
    ].join(" ").toLocaleLowerCase();
    return terms.some((term) => searchable.includes(term));
  });
}
