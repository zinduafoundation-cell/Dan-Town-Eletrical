export type POSReceiptData = {
  receiptNumber: string;
  customer: string;
  amount: number;
  items: number;
  date: string;
  paymentMethod: string;
  servedBy: string | null;
  staffRole: string | null;
};

const formatCurrency = (value: number) => `KSh ${value.toLocaleString("en-KE")}`;

export function formatReceiptText(receipt: POSReceiptData): string {
  const lines = [
    "DANTOWN ELECTRICAL",
    "POS RECEIPT",
    "----------------------------",
    `Receipt #: ${receipt.receiptNumber}`,
    `Date: ${receipt.date}`,
    `Customer: ${receipt.customer}`,
    `Items: ${receipt.items}`,
    `Payment: ${receipt.paymentMethod}`,
    receipt.servedBy ? `Served by: ${receipt.servedBy}` : "Served by: Walk-in staff",
    receipt.staffRole ? `Role: ${receipt.staffRole}` : "Role: Team member",
    "",
    `Total: ${formatCurrency(receipt.amount)}`,
    "----------------------------",
    "Thank you for shopping with Dantown",
    "Support: +254 700 000 000"
  ];

  return lines.join("\n");
}
