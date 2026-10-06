export type CashSession = {
  id: string;
  status: "open" | "closed";
  openingFloat: number;
  cashSales: number;
  countedCash: number | null;
  notes: string;
  startedAt: string | null;
  closedAt: string | null;
};

export type CashSessionSummary = {
  expected: number;
  variance: number;
  isHealthy: boolean;
  message: string;
};

export const CASH_SESSION_STORAGE_KEY = "dantown-pos-cash-session";

const toCurrencyValue = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const createSessionId = () => `cs-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

export function createCashSession(openingFloat: number, notes = ""): CashSession {
  return {
    id: createSessionId(),
    status: "open",
    openingFloat: Math.max(0, toCurrencyValue(openingFloat)),
    cashSales: 0,
    countedCash: null,
    notes,
    startedAt: new Date().toISOString(),
    closedAt: null
  };
}

export function recordCashSale(session: CashSession, amount: number): CashSession {
  if (session.status !== "open") {
    return session;
  }

  const cashAmount = Math.max(0, toCurrencyValue(amount));
  return {
    ...session,
    cashSales: Number((session.cashSales + cashAmount).toFixed(2))
  };
}

export function summarizeCashSession(session: Pick<CashSession, "openingFloat" | "cashSales" | "countedCash">): CashSessionSummary {
  const expected = Number((session.openingFloat + session.cashSales).toFixed(2));
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

export function closeCashSession(session: CashSession, countedCash: number, notes = ""): CashSession {
  const finalCountedCash = Math.max(0, toCurrencyValue(countedCash));
  return {
    ...session,
    countedCash: finalCountedCash,
    notes: notes || session.notes,
    closedAt: new Date().toISOString(),
    status: "closed"
  };
}

export function readCashSession(storage?: Storage): CashSession {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);

  if (!target) {
    return createCashSession(0);
  }

  const storedValue = target.getItem(CASH_SESSION_STORAGE_KEY);
  if (!storedValue) {
    return createCashSession(0);
  }

  try {
    const parsed = JSON.parse(storedValue) as Partial<CashSession>;
    return {
      id: typeof parsed.id === "string" ? parsed.id : createSessionId(),
      status: parsed.status === "closed" ? "closed" : "open",
      openingFloat: Math.max(0, toCurrencyValue(parsed.openingFloat)),
      cashSales: Math.max(0, toCurrencyValue(parsed.cashSales)),
      countedCash: typeof parsed.countedCash === "number" ? Math.max(0, parsed.countedCash) : null,
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : null,
      closedAt: typeof parsed.closedAt === "string" ? parsed.closedAt : null
    };
  } catch {
    return createCashSession(0);
  }
}

export function saveCashSession(session: CashSession, storage?: Storage): CashSession {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (target) {
    target.setItem(CASH_SESSION_STORAGE_KEY, JSON.stringify(session));
  }
  return session;
}
