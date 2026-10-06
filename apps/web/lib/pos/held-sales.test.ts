import { describe, expect, it } from "vitest";
import { createHeldSale, getHeldSales, upsertHeldSale } from "./held-sales";

describe("held sales", () => {
  it("creates a held sale snapshot with customer and cart totals", () => {
    const sale = createHeldSale({
      id: "held-1",
      customerName: "Grace Muthoni",
      cart: [
        { id: "p-1", name: "LED Panel", quantity: 2, price: 1200 }
      ],
      subtotal: 2400,
      vat: 240,
      total: 2640,
      createdAt: "2026-10-06T10:00:00.000Z"
    });

    expect(sale.id).toBe("held-1");
    expect(sale.customerName).toBe("Grace Muthoni");
    expect(sale.total).toBe(2640);
    expect(sale.cart).toHaveLength(1);
  });

  it("stores and reuses held sales without losing the most recent order", () => {
    const storage = new Map<string, string>();
    const first = createHeldSale({
      id: "held-1",
      customerName: "First customer",
      cart: [{ id: "p-1", name: "Bulb", quantity: 1, price: 250 }],
      subtotal: 250,
      vat: 25,
      total: 275,
      createdAt: "2026-10-06T10:00:00.000Z"
    });

    upsertHeldSale(first, storage);
    const second = createHeldSale({
      id: "held-2",
      customerName: "Second customer",
      cart: [{ id: "p-2", name: "Switch", quantity: 1, price: 500 }],
      subtotal: 500,
      vat: 50,
      total: 550,
      createdAt: "2026-10-06T10:05:00.000Z"
    });

    upsertHeldSale(second, storage);
    const sales = getHeldSales(storage);

    expect(sales).toHaveLength(2);
    expect(sales[0]?.id).toBe("held-2");
    expect(sales[1]?.id).toBe("held-1");
  });
});
