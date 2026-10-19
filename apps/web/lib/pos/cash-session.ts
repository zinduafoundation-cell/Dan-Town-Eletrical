export type CashSession = {
  id: string;
  status: "open" | "closed";
  openingFloat: number;
  cashSales: number;
  countedCash: number | null;
  expectedCash?: number;
  notes: string;
  startedAt: string | null;
  closedAt: string | null;
  warehouseId?: string;
  warehouseName?: string;
};

export type CashSessionSummary = {
  expected: number;
  variance: number;
  isHealthy: boolean;
  message: string;
};

export function summarizeCashSession(
  session: Pick<CashSession, "openingFloat" | "cashSales" | "countedCash"> & Partial<Pick<CashSession, "expectedCash">>
): CashSessionSummary {
  const expected = Number((session.expectedCash ?? session.openingFloat + session.cashSales).toFixed(2));
  const countedCash = session.countedCash ?? expected;
  const variance = Number((countedCash - expected).toFixed(2));
  const isHealthy = Math.abs(variance) <= 200;

  let message = "Cash box is balanced.";
  if (variance > 0) {
    message = `Cash over by KSh ${variance.toLocaleString("en-KE")}.`;
  } else if (variance < 0) {
    message = `Cash short by KSh ${Math.abs(variance).toLocaleString("en-KE")}.`;
  }

  return { expected, variance, isHealthy, message };
}
