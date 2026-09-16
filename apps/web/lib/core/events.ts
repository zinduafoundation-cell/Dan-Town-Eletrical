export type DomainEventMap = {
  SALE_COMPLETED: { orderId: string; orderNumber: string; total: number; source: "POS" | "ONLINE" };
  PAYMENT_COMPLETED: { paymentId: string; orderId: string; amount: number };
  STOCK_UPDATED: { productId: string; quantity: number; reason: string };
  ORDER_CREATED: { orderId: string; orderNumber: string; source: "POS" | "ONLINE" };
  OFFLINE_SALE_CREATED: { transactionId: string; createdAt: string };
  OFFLINE_DATA_SYNCED: { transactionId: string; orderId: string };
  SYNC_FAILED: { transactionId: string; reason: string; retryCount: number };
  AI_SUPPORT_ESCALATED: { escalationId: string; userId: string | null; category: string; summary: string; occurredAt: string };
};

export type DomainEvent<TName extends keyof DomainEventMap = keyof DomainEventMap> = {
  id: string;
  name: TName;
  occurredAt: string;
  payload: DomainEventMap[TName];
};

type EventHandler<TName extends keyof DomainEventMap> = (event: DomainEvent<TName>) => void | Promise<void>;
const handlers = new Map<keyof DomainEventMap, Set<EventHandler<never>>>();

export function subscribe<TName extends keyof DomainEventMap>(name: TName, handler: EventHandler<TName>) {
  const listeners = handlers.get(name) ?? new Set<EventHandler<never>>();
  listeners.add(handler as EventHandler<never>);
  handlers.set(name, listeners);
  return () => listeners.delete(handler as EventHandler<never>);
}

export function emit<TName extends keyof DomainEventMap>(name: TName, payload: DomainEventMap[TName]) {
  const event: DomainEvent<TName> = { id: crypto.randomUUID(), name, occurredAt: new Date().toISOString(), payload };
  for (const handler of handlers.get(name) ?? []) {
    Promise.resolve(handler(event as DomainEvent<never>)).catch((error) => console.error(`Domain event ${name} failed`, error));
  }
  return event;
}