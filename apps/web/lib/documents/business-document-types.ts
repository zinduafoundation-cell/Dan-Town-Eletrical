import type { BusinessDocumentType } from "@dantown/database";

export const businessDocumentGroups = [
  { value: "SALES", label: "Sales and customers", description: "Quotes, orders, invoices and returns" },
  { value: "PURCHASES", label: "Purchases and suppliers", description: "Requisitions, orders, bills and receiving" },
  { value: "INVENTORY", label: "Inventory and warehouse", description: "Movement, stock control and delivery records" },
  { value: "FINANCE", label: "Finance and accounting", description: "Vouchers, reconciliations and financial records" },
  { value: "PARTIES", label: "Customers and suppliers", description: "Registration, credit and account records" },
  { value: "COMPLIANCE", label: "Tax and compliance", description: "KRA, eTIMS, VAT and registration records" },
  { value: "ADMINISTRATION", label: "Administration and HR", description: "Contracts, employee, leave and approval records" },
  { value: "REPORTS", label: "Reports and dashboards", description: "Dated reports and management records" },
  { value: "ARCHIVE", label: "Archive", description: "Historical or closed business records" },
] as const;

export type BusinessDocumentGroup = typeof businessDocumentGroups[number]["value"];

export const defaultDocumentPrefixes: Record<BusinessDocumentType, string> = {
  QUOTATION: "QUO",
  SALES_ORDER: "SO",
  PROFORMA_INVOICE: "PI",
  INVOICE: "INV",
  RECEIPT: "REC",
  CREDIT_NOTE: "CN",
  DEBIT_NOTE: "DBN",
  CUSTOMER_STATEMENT: "CST",
  SALES_RETURN_FORM: "SRF",
  PURCHASE_REQUISITION: "PR",
  PURCHASE_ORDER: "PO",
  SUPPLIER_INVOICE: "BILL",
  GOODS_RECEIVED_NOTE: "GRN",
  SUPPLIER_PAYMENT_VOUCHER: "SPV",
  SUPPLIER_STATEMENT: "SST",
  PURCHASE_RETURN_FORM: "PRN",
  STOCK_REGISTER: "STR",
  GOODS_ISSUE: "GI",
  STOCK_TRANSFER_NOTE: "STN",
  DELIVERY_NOTE: "DN",
  DISPATCH_NOTE: "DIS",
  STOCK_ADJUSTMENT: "SA",
  STOCK_COUNT_SHEET: "SCS",
  DAMAGED_GOODS_REPORT: "DGR",
  GOODS_RETURN_NOTE: "SRN",
  CASH_RECEIPT_VOUCHER: "CRV",
  PAYMENT_VOUCHER: "PV",
  PETTY_CASH_VOUCHER: "PCV",
  CASHBOOK: "CB",
  DAILY_SALES_REPORT: "DSR",
  DAILY_EXPENSE_REPORT: "DER",
  BANK_RECONCILIATION: "BR",
  MPESA_RECONCILIATION: "MR",
  ACCOUNTS_RECEIVABLE_REPORT: "ARPT",
  ACCOUNTS_PAYABLE_REPORT: "APPT",
  PROFIT_AND_LOSS_REPORT: "PL",
  GENERAL_LEDGER_REPORT: "GL",
  CUSTOMER_REGISTRATION: "CUS",
  SUPPLIER_REGISTRATION: "SUP",
  CREDIT_APPLICATION: "CA",
  CUSTOMER_ACCOUNT_RECORD: "CAR",
  SUPPLIER_ACCOUNT_RECORD: "SAR",
  COMPLAINT_RETURN_FORM: "CRF",
  BUSINESS_REGISTRATION_RECORD: "BRR",
  KRA_RECORD: "KRA",
  ETIMS_TAX_INVOICE: "ETI",
  VAT_RECORD: "VAT",
  TAX_RETURN_SUPPORT: "TRS",
  BUSINESS_PERMIT: "BP",
  REGISTRATION_CERTIFICATE: "RC",
  CONTRACT: "CON",
  EMPLOYEE_RECORD: "EMP",
  PAYROLL_DOCUMENT: "PAY",
  LEAVE_RECORD: "LEV",
  ASSET_REGISTER: "AST",
  INTERNAL_APPROVAL: "IAP",
  INCIDENT_REPORT: "IR",
  FILING_REGISTER: "FR",
  OTHER: "DOC",
};

type DocumentTypeConfig = {
  value: BusinessDocumentType;
  label: string;
  group: BusinessDocumentGroup;
  requiresCounterparty?: boolean;
  requiresLineItems?: boolean;
  sourceRecordRequired?: boolean;
  sourceOnly?: boolean;
};

export const businessDocumentTypes: readonly DocumentTypeConfig[] = [
  { value: "QUOTATION", label: "Quotation", group: "SALES", requiresCounterparty: true, requiresLineItems: true },
  { value: "SALES_ORDER", label: "Sales order", group: "SALES", requiresCounterparty: true, requiresLineItems: true, sourceRecordRequired: true },
  { value: "PROFORMA_INVOICE", label: "Proforma invoice", group: "SALES", requiresCounterparty: true, requiresLineItems: true },
  { value: "INVOICE", label: "Invoice", group: "SALES", requiresCounterparty: true, requiresLineItems: true },
  { value: "RECEIPT", label: "Payment receipt", group: "SALES", requiresCounterparty: true, sourceRecordRequired: true, sourceOnly: true },
  { value: "CREDIT_NOTE", label: "Credit note", group: "SALES", requiresCounterparty: true, requiresLineItems: true, sourceRecordRequired: true },
  { value: "DEBIT_NOTE", label: "Debit note", group: "SALES", requiresCounterparty: true, requiresLineItems: true, sourceRecordRequired: true },
  { value: "CUSTOMER_STATEMENT", label: "Customer statement", group: "SALES", requiresCounterparty: true, sourceRecordRequired: true },
  { value: "SALES_RETURN_FORM", label: "Sales return form", group: "SALES", requiresCounterparty: true, requiresLineItems: true, sourceRecordRequired: true },
  { value: "PURCHASE_REQUISITION", label: "Purchase requisition", group: "PURCHASES", requiresCounterparty: false, requiresLineItems: true },
  { value: "PURCHASE_ORDER", label: "Purchase order", group: "PURCHASES", requiresCounterparty: true, requiresLineItems: true },
  { value: "SUPPLIER_INVOICE", label: "Supplier invoice / bill", group: "PURCHASES", requiresCounterparty: true, requiresLineItems: true, sourceRecordRequired: true },
  { value: "GOODS_RECEIVED_NOTE", label: "Goods received note", group: "PURCHASES", requiresCounterparty: true, requiresLineItems: true, sourceRecordRequired: true },
  { value: "SUPPLIER_PAYMENT_VOUCHER", label: "Supplier payment voucher", group: "PURCHASES", requiresCounterparty: true, sourceRecordRequired: true, sourceOnly: true },
  { value: "SUPPLIER_STATEMENT", label: "Supplier statement", group: "PURCHASES", requiresCounterparty: true, sourceRecordRequired: true },
  { value: "PURCHASE_RETURN_FORM", label: "Purchase return form", group: "PURCHASES", requiresCounterparty: true, requiresLineItems: true, sourceRecordRequired: true },
  { value: "STOCK_REGISTER", label: "Stock register", group: "INVENTORY", sourceRecordRequired: true },
  { value: "GOODS_ISSUE", label: "Goods issue voucher", group: "INVENTORY", requiresCounterparty: false, requiresLineItems: true, sourceRecordRequired: true },
  { value: "STOCK_TRANSFER_NOTE", label: "Stock transfer note", group: "INVENTORY", requiresLineItems: true, sourceRecordRequired: true },
  { value: "DELIVERY_NOTE", label: "Delivery note", group: "INVENTORY", requiresCounterparty: true, requiresLineItems: true, sourceRecordRequired: true },
  { value: "DISPATCH_NOTE", label: "Dispatch note", group: "INVENTORY", requiresCounterparty: true, requiresLineItems: true, sourceRecordRequired: true },
  { value: "STOCK_ADJUSTMENT", label: "Stock adjustment", group: "INVENTORY", requiresLineItems: true, sourceRecordRequired: true },
  { value: "STOCK_COUNT_SHEET", label: "Stock count sheet", group: "INVENTORY", requiresLineItems: true, sourceRecordRequired: true },
  { value: "DAMAGED_GOODS_REPORT", label: "Damaged goods report", group: "INVENTORY", requiresLineItems: true, sourceRecordRequired: true },
  { value: "GOODS_RETURN_NOTE", label: "Goods return note", group: "INVENTORY", requiresLineItems: true, sourceRecordRequired: true },
  { value: "CASH_RECEIPT_VOUCHER", label: "Cash receipt voucher", group: "FINANCE", requiresCounterparty: true, sourceRecordRequired: true, sourceOnly: true },
  { value: "PAYMENT_VOUCHER", label: "Payment voucher", group: "FINANCE", requiresCounterparty: true, sourceRecordRequired: true, sourceOnly: true },
  { value: "PETTY_CASH_VOUCHER", label: "Petty cash voucher", group: "FINANCE", requiresCounterparty: true, sourceRecordRequired: true, sourceOnly: true },
  { value: "CASHBOOK", label: "Cashbook entry", group: "FINANCE", sourceRecordRequired: true },
  { value: "DAILY_SALES_REPORT", label: "Daily sales report", group: "REPORTS", sourceRecordRequired: true },
  { value: "DAILY_EXPENSE_REPORT", label: "Daily expense report", group: "REPORTS", sourceRecordRequired: true },
  { value: "BANK_RECONCILIATION", label: "Bank reconciliation", group: "FINANCE", sourceRecordRequired: true },
  { value: "MPESA_RECONCILIATION", label: "M-Pesa reconciliation", group: "FINANCE", sourceRecordRequired: true },
  { value: "ACCOUNTS_RECEIVABLE_REPORT", label: "Accounts receivable report", group: "REPORTS", sourceRecordRequired: true },
  { value: "ACCOUNTS_PAYABLE_REPORT", label: "Accounts payable report", group: "REPORTS", sourceRecordRequired: true },
  { value: "PROFIT_AND_LOSS_REPORT", label: "Profit and loss report", group: "REPORTS", sourceRecordRequired: true },
  { value: "GENERAL_LEDGER_REPORT", label: "General ledger report", group: "REPORTS", sourceRecordRequired: true },
  { value: "CUSTOMER_REGISTRATION", label: "Customer registration form", group: "PARTIES", requiresCounterparty: true },
  { value: "SUPPLIER_REGISTRATION", label: "Supplier registration form", group: "PARTIES", requiresCounterparty: true },
  { value: "CREDIT_APPLICATION", label: "Customer credit application", group: "PARTIES", requiresCounterparty: true },
  { value: "CUSTOMER_ACCOUNT_RECORD", label: "Customer account record", group: "PARTIES", requiresCounterparty: true, sourceRecordRequired: true },
  { value: "SUPPLIER_ACCOUNT_RECORD", label: "Supplier account record", group: "PARTIES", requiresCounterparty: true, sourceRecordRequired: true },
  { value: "COMPLAINT_RETURN_FORM", label: "Customer complaint / return form", group: "PARTIES", requiresCounterparty: true },
  { value: "BUSINESS_REGISTRATION_RECORD", label: "Business registration record", group: "COMPLIANCE" },
  { value: "KRA_RECORD", label: "KRA record", group: "COMPLIANCE", sourceRecordRequired: true },
  { value: "ETIMS_TAX_INVOICE", label: "eTIMS tax invoice record", group: "COMPLIANCE", requiresCounterparty: true, sourceRecordRequired: true },
  { value: "VAT_RECORD", label: "VAT record", group: "COMPLIANCE", sourceRecordRequired: true },
  { value: "TAX_RETURN_SUPPORT", label: "Tax return supporting record", group: "COMPLIANCE", sourceRecordRequired: true },
  { value: "BUSINESS_PERMIT", label: "Business permit", group: "COMPLIANCE" },
  { value: "REGISTRATION_CERTIFICATE", label: "Registration certificate", group: "COMPLIANCE" },
  { value: "CONTRACT", label: "Contract / agreement", group: "ADMINISTRATION", requiresCounterparty: true },
  { value: "EMPLOYEE_RECORD", label: "Employee record", group: "ADMINISTRATION", requiresCounterparty: true },
  { value: "PAYROLL_DOCUMENT", label: "Payroll document", group: "ADMINISTRATION", sourceRecordRequired: true },
  { value: "LEAVE_RECORD", label: "Leave record", group: "ADMINISTRATION", requiresCounterparty: true },
  { value: "ASSET_REGISTER", label: "Asset register", group: "ADMINISTRATION" },
  { value: "INTERNAL_APPROVAL", label: "Internal approval", group: "ADMINISTRATION" },
  { value: "INCIDENT_REPORT", label: "Incident report", group: "ADMINISTRATION" },
  { value: "FILING_REGISTER", label: "Filing and archive register", group: "ARCHIVE" },
  { value: "OTHER", label: "Other business document", group: "ARCHIVE" },
];

export const sourceOnlyDocumentTypes = new Set(
  businessDocumentTypes.filter((type) => type.sourceOnly).map((type) => type.value),
);

export const businessDocumentStatuses = [
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_APPROVAL", label: "Pending approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "SENT", label: "Sent" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PARTIALLY_DELIVERED", label: "Partially delivered" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REVERSED", label: "Reversed" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

export type BusinessDocumentStatus = typeof businessDocumentStatuses[number]["value"];

export type BusinessDocumentSourceKind = "order" | "purchase_order";

const businessDocumentSourceKinds: Partial<Record<BusinessDocumentType, BusinessDocumentSourceKind>> = {
  SALES_ORDER: "order",
  INVOICE: "order",
  CREDIT_NOTE: "order",
  DEBIT_NOTE: "order",
  SALES_RETURN_FORM: "order",
  DELIVERY_NOTE: "order",
  DISPATCH_NOTE: "order",
  PURCHASE_ORDER: "purchase_order",
  SUPPLIER_INVOICE: "purchase_order",
  GOODS_RECEIVED_NOTE: "purchase_order",
  PURCHASE_RETURN_FORM: "purchase_order",
};

export function getBusinessDocumentSourceKind(type: BusinessDocumentType) {
  return businessDocumentSourceKinds[type];
}

export function getBusinessDocumentType(type: BusinessDocumentType): DocumentTypeConfig | undefined {
  return businessDocumentTypes.find((item) => item.value === type);
}

export function isBusinessDocumentType(type: string): type is BusinessDocumentType {
  return businessDocumentTypes.some((item) => item.value === type);
}
