/* eslint-disable @next/next/no-img-element -- Product images are administrator-supplied remote URLs. */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Banknote, CreditCard, Minus, Pause, Play, Plus, Search, ShoppingCart, Sparkles, Trash2 } from "lucide-react";
import { z } from "zod";
import { APP_CURRENCY } from "@dantown/shared";
import { CameraBarcodeScanner } from "@/components/pos/camera-barcode-scanner";
import { CashSessionPanel } from "@/components/pos/cash-session";
import { getQueuedProductQuantities } from "@/lib/pos/offline-queue";
import { matchesPOSProduct } from "@/lib/pos/product-search";
import { getOfflinePOSProducts, type OfflinePOSProduct } from "@/lib/centre/offline-storage";
import { createHeldSale, getHeldSales, removeHeldSale, upsertHeldSale, type HeldSale } from "@/lib/pos/held-sales";
import { showPOSReceiptEffect } from "@/lib/pos/receipt-effect";
import { boughtTogether, money, parseSmartLine, topPicks } from "@/lib/pos/smart";

type Product = OfflinePOSProduct;
type CartItem = Product & { cartQty: number };
type Customer = { id: string; name: string; phone: string | null; email: string | null };

const cashCheckoutResponseSchema = z.object({
  success: z.literal(true),
  change: z.number().finite(),
  receipt: z.object({
    receiptNumber: z.string(),
    subtotal: z.number(),
    discount: z.number(),
    tax: z.number(),
    delivery: z.number(),
    total: z.number(),
    paymentMethod: z.string(),
    date: z.string(),
    items: z.array(z.object({
      name: z.string(),
      sku: z.string().nullable(),
      qty: z.number(),
      total: z.number(),
    })).min(1),
  }),
});

async function fetchProducts(search: string, limit = 100): Promise<Product[]> {
  const getCachedProducts = async () => {
    const catalogue = await getOfflinePOSProducts();
    if (!catalogue?.complete) throw new Error("No complete product catalogue is saved for offline POS. Connect and download it first.");
    const queuedQuantities = await getQueuedProductQuantities();
    return catalogue.products
      .map((product) => ({ ...product, qty: Math.max(0, product.qty - (queuedQuantities[product.id] ?? 0)) }))
      .filter((product) => matchesPOSProduct(product, search))
      .slice(0, search ? limit : catalogue.products.length);
  };

  if (!navigator.onLine) return getCachedProducts();
  try {
    const response = await fetch(`/api/pos/products?limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`);
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error ?? "Failed to load products.");
    return result.data as Product[];
  } catch (error) {
    if (navigator.onLine) throw error;
    return getCachedProducts();
  }
}

export default function NewSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentEmail, setPaymentEmail] = useState("");
  const [tenderMethod, setTenderMethod] = useState<"CASH" | "PESAPAL">("PESAPAL");
  const [cashReceived, setCashReceived] = useState("");
  const [processing, setProcessing] = useState(false);
  const [cashSessionId, setCashSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [held, setHeld] = useState<HeldSale[]>(() => getHeldSales());
  const [picks, setPicks] = useState<string[]>([]);
  const [seenProducts, setSeenProducts] = useState<Map<string, Product>>(() => new Map());
  const searchRef = useRef<HTMLInputElement>(null);
  const checkoutRequestId = useRef<string | null>(null);

  useEffect(() => {
    const refreshConnection = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (!online) {
        setCustomerName("Walk-in Customer");
        setCustomerSearch("");
        setSelectedCustomer(null);
        setCustomers([]);
      }
    };
    refreshConnection();
    window.addEventListener("online", refreshConnection);
    window.addEventListener("offline", refreshConnection);
    return () => {
      window.removeEventListener("online", refreshConnection);
      window.removeEventListener("offline", refreshConnection);
    };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setHeld(getHeldSales()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    checkoutRequestId.current = null;
  }, [cart]);

  const remember = useCallback((list: Product[]) => {
    setSeenProducts((current) => {
      const next = new Map(current);
      list.forEach((product) => next.set(product.id, product));
      return next;
    });
  }, []);

  // Server-side search (fixes the old 40-product ceiling) with debounce.
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try { const list = await fetchProducts(search.trim()); remember(list); setProducts(list); setPicks(topPicks()); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Failed to load products."); }
      finally { setLoading(false); }
    }, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [search, remember]);

  useEffect(() => {
    const listener = (event: Event) => window.setTimeout(() => setSearch((event as CustomEvent<string>).detail), 0);
    window.addEventListener("dantown-pos-search", listener);
    return () => window.removeEventListener("dantown-pos-search", listener);
  }, []);
  useEffect(() => {
    if (customerSearch.trim().length < 2) { const timer = window.setTimeout(() => setCustomers([]), 0); return () => window.clearTimeout(timer); }
    if (!navigator.onLine) return;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/pos/customers?q=${encodeURIComponent(customerSearch)}`);
        if (response.ok) setCustomers((await response.json()).customers ?? []);
      } catch (error) {
        console.error("Unable to search POS customers.", error);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map((product) => product.category))).sort()], [products]);
  const visible = useMemo(() => products.filter((product) => matchesPOSProduct(product, search) && (category === "All" || product.category === category)), [products, search, category]);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.cartQty, 0);
  const vat = cart.reduce((sum, item) => sum + Math.round(item.price * item.cartQty * item.vatRate) / 100, 0);
  const total = subtotal + vat;
  const itemCount = cart.reduce((count, item) => count + item.cartQty, 0);
  const cartIds = cart.map((item) => item.id);
  const together = useMemo(() => boughtTogether(cartIds).map((id) => seenProducts.get(id)).filter((p): p is Product => !!p && p.qty > 0), [cartIds, seenProducts]);
  const pickProducts = useMemo(() => picks.map((id) => seenProducts.get(id)).filter((p): p is Product => !!p && p.qty > 0).slice(0, 6), [picks, seenProducts]);

  const addToCart = useCallback((product: Product, qty = 1) => {
    if (product.qty < 1) return setMessage(`${product.name} is out of stock.`);
    navigator.vibrate?.(12);
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing && existing.cartQty + qty > product.qty) setMessage(`Only ${product.qty} of ${product.name} in stock.`);
      return existing ? current.map((item) => item.id === product.id ? { ...item, cartQty: Math.min(item.qty, item.cartQty + qty) } : item) : [...current, { ...product, cartQty: Math.min(product.qty, qty) }];
    });
  }, []);
  const updateQuantity = (id: string, quantity: number) => setCart((current) => quantity < 1 ? current.filter((item) => item.id !== id) : current.map((item) => item.id === id ? { ...item, cartQty: Math.min(item.qty, quantity) } : item));
  const clearSale = useCallback(() => { checkoutRequestId.current = null; setCart([]); setCustomerName("Walk-in Customer"); setCustomerSearch(""); setSelectedCustomer(null); setCustomers([]); setPaymentEmail(""); setCashReceived(""); }, []);

  // Barcode (exact) -> loaded list, else ask the server. Used by scanners, camera and Enter key.
  const scanBarcode = useCallback(async (raw: string) => {
    const code = raw.trim().toLowerCase();
    if (!code) return false;
    let product = [...seenProducts.values()].find((item) => item.barcode?.trim().toLowerCase() === code);
    if (!product) {
      try {
        const found = await fetchProducts(raw.trim(), 5);
        remember(found);
        product = found.find((item) => item.barcode?.trim().toLowerCase() === code);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Barcode lookup failed.");
        return false;
      }
    }
    if (!product) { setMessage(`No product matched barcode ${raw.trim()}.`); return false; }
    addToCart(product); setSearch(""); return true;
  }, [addToCart, remember, seenProducts]);

  // Smart entry: "5 2.5mm cable" adds the single best match; otherwise shows candidates.
  const submitSearch = async () => {
    if (!search.trim()) return;
    if (await scanBarcode(search)) return;
    const { qty, query } = parseSmartLine(search);
    try {
      const found = await fetchProducts(query, 10); remember(found);
      const inStock = found.filter((item) => item.qty > 0);
      const exact = inStock.filter((item) => item.sku.toLowerCase() === query.toLowerCase());
      const best = exact.length === 1 ? exact[0] : inStock.length === 1 ? inStock[0] : null;
      if (best) { addToCart(best, qty); setSearch(""); } else { setSearch(query); setMessage(found.length ? "Several matches: tap the right one." : "No match found."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Search failed."); }
  };

  // Hardware scanners type fast and end with Enter, so catch them even when no field is focused.
  useEffect(() => {
    let buffer = ""; let last = 0;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (event.key === "F2" || (event.key === "/" && !typing)) { event.preventDefault(); searchRef.current?.focus(); return; }
      if (event.key === "Escape") { setSearch(""); return; }
      if (typing) return;
      const now = Date.now();
      if (event.key === "Enter") { if (buffer.length >= 6) void scanBarcode(buffer); buffer = ""; return; }
      if (event.key.length === 1) { buffer = now - last > 60 ? event.key : buffer + event.key; last = now; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scanBarcode]);

  const holdSale = () => {
    if (!cart.length) return;
    const sale = createHeldSale({
      id: `held-${Date.now()}`,
      customerName: selectedCustomer?.name ?? customerName,
      cart: cart.map((item) => ({ id: item.id, name: item.name, quantity: item.cartQty, price: item.price })),
      subtotal,
      vat,
      total,
      createdAt: new Date().toISOString(),
    });
    const next = upsertHeldSale(sale);
    setHeld(next);
    clearSale();
    setMessage(`Sale held for ${sale.customerName}.`);
  };
  const recallSale = (sale: HeldSale) => {
    if (cart.length) return setMessage("Finish or hold the  before recalling another.");
    const restored = sale.cart
      .map((item) => {
        const product = seenProducts.get(item.id) ?? products.find((entry) => entry.id === item.id);
        if (!product || product.qty < 1) return null;
        return { ...product, cartQty: Math.min(item.quantity, product.qty) };
      })
      .filter((item): item is CartItem => item !== null);
    setCart(restored);
    setCustomerName(sale.customerName);
    setCustomerSearch(sale.customerName === "Walk-in Customer" ? "" : sale.customerName);
    setSelectedCustomer(null);
    setHeld(removeHeldSale(sale.id));
    if (restored.length < sale.cart.length) setMessage("Some held-sale items are unavailable or out of stock.");
    else setMessage(`Held sale for ${sale.customerName} restored.`);
  };

  const completeSale = async () => {
    if (!cart.length) return setMessage("Cart is empty.");
    if (!navigator.onLine) return setMessage("Connect to the internet to record this sale securely.");
    if (tenderMethod === "CASH" && !cashSessionId) return setMessage("Open a cash session before accepting cash.");
    const cashAmount = Number(cashReceived);
    if (tenderMethod === "CASH" && (!Number.isFinite(cashAmount) || cashAmount < total)) {
      return setMessage("Enter the cash amount received; it must cover the current sale total.");
    }
    if (tenderMethod === "PESAPAL" && !paymentEmail.trim()) return setMessage("Enter the customer email required for Pesapal checkout.");
    const requestId = checkoutRequestId.current ?? window.crypto.randomUUID();
    checkoutRequestId.current = requestId;
    const payload = {
      requestId,
      customerId: selectedCustomer?.id ?? null,
      customerName,
      email: paymentEmail.trim(),
      phone: selectedCustomer?.phone ?? null,
      items: cart.map((item) => ({ productId: item.id, quantity: item.cartQty })),
    };
    try {
      setProcessing(true); setMessage(null);
      if (tenderMethod === "CASH") {
        const response = await fetch("/api/pos/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId,
            customerId: selectedCustomer?.id ?? null,
            cashReceived: cashAmount,
            subtotal,
            vat,
            total,
            items: cart.map((item) => ({ productId: item.id, quantity: item.cartQty })),
          }),
        });
        const result: unknown = await response.json();
        const parsedResult = cashCheckoutResponseSchema.safeParse(result);
        if (!response.ok || !parsedResult.success) {
          const error = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "Unable to record the cash sale.";
          throw new Error(error);
        }
        const { receipt, change } = parsedResult.data;
        showPOSReceiptEffect({ ...receipt, currency: APP_CURRENCY });
        window.dispatchEvent(new Event("dantown-pos-cash-session-refresh"));
        clearSale();
        setMessage(`Cash sale recorded. Change due: ${money(change)}.`);
        return;
      }
      const response = await fetch("/api/pos/pesapal-init", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || typeof result !== "object" || result === null ||
        !("redirectUrl" in result) || typeof result.redirectUrl !== "string" ||
        !("orderId" in result) || typeof result.orderId !== "string") {
        throw new Error(typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : "Unable to start Pesapal checkout.");
      }
      window.location.assign(result.redirectUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Unable to complete ${tenderMethod.toLowerCase()} checkout.`);
    } finally { setProcessing(false); }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "F8") { event.preventDefault(); void completeSale(); } if (event.key === "F4") { event.preventDefault(); holdSale(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ProductTile = ({ product, compact = false }: { product: Product; compact?: boolean }) => (
    <button type="button" className={`px-tile ${compact ? "compact" : ""} ${product.qty === 0 ? "out" : ""}`} onClick={() => addToCart(product)} disabled={!product.qty}>
      {!compact && <span className="px-tile-img">{product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <b>{product.name.charAt(0)}</b>}</span>}
      <span className="px-tile-name">{product.name}</span>
      <span className="px-tile-meta">{product.sku}</span>
      <span className="px-tile-foot"><strong>{money(product.price)}</strong><em className={product.qty === 0 ? "out" : product.qty <= 5 ? "low" : ""}>{product.qty === 0 ? "Out" : product.qty <= 5 ? `Only ${product.qty} left` : `${product.qty} in stock`}</em></span>
    </button>
  );

  return <div className="px-register">
    {message && <div className="px-toast" role="status"><AlertCircle size={18} /><span>{message}</span><button type="button" onClick={() => setMessage(null)} aria-label="Dismiss">×</button></div>}
    {!isOnline && <div className="px-toast" role="status"><AlertCircle size={18} /><span>Offline mode: browsing the saved catalogue is available, but recording a new cash or Pesapal sale requires an internet connection.</span></div>}

    <section className="px-catalog">
      <div className="px-search">
        <Search size={18} />
        <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitSearch(); }} placeholder="Search, scan a barcode, or type “5 2.5mm cable”" aria-label="Search products" />
        <CameraBarcodeScanner onDetected={(code) => void scanBarcode(code)} />
      </div>
      <p className="px-hint"><Sparkles size={12} /> Smart entry adds the best match · <kbd>F2</kbd> search · <kbd>F4</kbd> hold · <kbd>F8</kbd> pay</p>
      {!search && pickProducts.length > 0 && <div className="px-picks"><h3>Your quick picks</h3><div>{pickProducts.map((product) => <ProductTile key={product.id} product={product} compact />)}</div></div>}
      <div className="px-chips">{categories.map((name) => <button type="button" key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name}</button>)}</div>
      <div className="px-grid">{loading ? <p className="px-empty">Loading products…</p> : visible.length ? visible.map((product) => <ProductTile key={product.id} product={product} />) : <p className="px-empty">No products match “{search}”.</p>}</div>
    </section>

    <aside className="px-cart" id="pos-cart-section">
      <div className="px-cart-head"><h2></h2><div>
        {held.length > 0 && <details className="px-held"><summary><Play size={14} /> Held ({held.length})</summary><div className="px-held-list">{held.map((sale) => <div className="px-held-item" key={sale.id}><button type="button" className="px-held-recall" onClick={() => recallSale(sale)}><span>{sale.customerName} · {sale.cart.length} item{sale.cart.length === 1 ? "" : "s"}</span><small>{new Date(sale.updatedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</small></button><button type="button" className="px-held-remove" aria-label={`Remove held sale for ${sale.customerName}`} onClick={() => setHeld(removeHeldSale(sale.id))}><Trash2 size={14} /></button></div>)}</div></details>}
        {cart.length > 0 && <><button type="button" className="px-ghost" onClick={holdSale}><Pause size={14} /> Hold</button><button type="button" className="px-ghost" onClick={clearSale}>Clear</button></>}
      </div></div>
      <div className="px-checkout">
        <CashSessionPanel onSessionChange={setCashSessionId} />
      </div>

      <div className="px-lines">{cart.length === 0 ? <p className="px-empty"><ShoppingCart size={26} /><br />Scan or search to start a sale</p> : cart.map((item) => <div key={item.id} className="px-line">
        <div><strong>{item.name}</strong><small>{money(item.price)} each{item.cartQty >= item.qty ? " · max stock" : ""}</small></div>
        <b>{money(item.price * item.cartQty)}</b>
        <div className="px-qty"><button type="button" onClick={() => updateQuantity(item.id, item.cartQty - 1)} aria-label="Decrease"><Minus size={14} /></button><input type="number" min={1} max={item.qty} value={item.cartQty} onChange={(event) => updateQuantity(item.id, Number(event.target.value))} aria-label="Quantity" /><button type="button" onClick={() => updateQuantity(item.id, item.cartQty + 1)} aria-label="Increase"><Plus size={14} /></button><button type="button" className="danger" onClick={() => updateQuantity(item.id, 0)} aria-label="Remove"><Trash2 size={14} /></button></div>
      </div>)}</div>

      {together.length > 0 && <div className="px-together"><h3><Sparkles size={13} /> Often bought together</h3><div>{together.map((product) => <button type="button" key={product.id} onClick={() => addToCart(product)}>+ {product.name}<small>{money(product.price)}</small></button>)}</div></div>}

      {cart.length > 0 && <div className="px-checkout">
        <div className="px-field"><input value={customerSearch || customerName} onChange={(event) => { setCustomerSearch(event.target.value); setCustomerName(event.target.value || "Walk-in Customer"); setSelectedCustomer(null); setPaymentEmail(""); }} placeholder={isOnline ? "Customer (optional)" : "Walk-in only while offline"} aria-label="Customer" disabled={!isOnline} />
          {customers.length > 0 && <div className="px-dropdown">{customers.map((customer) => <button type="button" key={customer.id} onClick={() => { setSelectedCustomer(customer); setCustomerName(customer.name); setCustomerSearch(customer.name); setPaymentEmail(customer.email ?? ""); setCustomers([]); }}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</button>)}</div>}</div>
        <div className="px-tenders" aria-label="Payment method">
          <button type="button" className={tenderMethod === "CASH" ? "active" : ""} onClick={() => setTenderMethod("CASH")} disabled={!isOnline}>
            <Banknote size={18} /> Cash
          </button>
          <button type="button" className={tenderMethod === "PESAPAL" ? "active" : ""} onClick={() => setTenderMethod("PESAPAL")} disabled={!isOnline}>
            <CreditCard size={18} /> Pesapal
          </button>
        </div>
        {tenderMethod === "CASH" ? (
          <label className="px-field">
            <input
              type="number"
              min={total}
              step="0.01"
              inputMode="decimal"
              value={cashReceived}
              onChange={(event) => setCashReceived(event.target.value)}
              placeholder={`Cash received (at least ${money(total)})`}
              aria-label="Cash received from customer"
              required
              disabled={!isOnline}
            />
            {Number(cashReceived) >= total && <small>Change due: {money(Number(cashReceived) - total)}</small>}
          </label>
        ) : (
          <label className="px-field">
            <input
              type="email"
              autoComplete="email"
              value={paymentEmail}
              onChange={(event) => setPaymentEmail(event.target.value)}
              placeholder="Customer email for Pesapal"
              aria-label="Customer email for Pesapal"
              required
              disabled={!isOnline}
            />
          </label>
        )}
        <div className="px-totals"><p><span>Subtotal</span><b>{money(subtotal)}</b></p><p><span>VAT</span><b>{money(vat)}</b></p></div>
        <button
          type="button"
          className="px-pay"
          onClick={completeSale}
          disabled={processing || !isOnline || (tenderMethod === "CASH" ? !cashSessionId || Number(cashReceived) < total : !paymentEmail.trim())}
        >
          <span>{processing
            ? tenderMethod === "CASH" ? "Recording cash sale…" : "Connecting to Pesapal…"
            : tenderMethod === "CASH" ? "Confirm cash received" : "Pay with Pesapal"}</span>
          <strong>{money(total)}</strong>
        </button>
      </div>}
    </aside>
    {itemCount > 0 && <button type="button" className="px-mobile-cart" onClick={() => document.getElementById("pos-cart-section")?.scrollIntoView({ behavior: "smooth" })}><ShoppingCart size={18} /><span>View cart</span><strong>{itemCount} · {money(total)}</strong></button>}
  </div>;
}
