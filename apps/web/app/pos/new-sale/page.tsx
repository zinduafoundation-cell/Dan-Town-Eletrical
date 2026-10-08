/* eslint-disable @next/next/no-img-element -- Product images are administrator-supplied remote URLs. */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Banknote, Building2, CreditCard, Minus, Pause, Play, Plus, Receipt, Search, ShoppingCart, Smartphone, Sparkles, Trash2, type LucideIcon } from "lucide-react";
import { CameraBarcodeScanner } from "@/components/pos/camera-barcode-scanner";
import { CashSessionPanel } from "@/components/pos/cash-session";
import { enqueueSale } from "@/lib/pos/offline-queue";
import { matchesPOSProduct } from "@/lib/pos/product-search";
import { createCashSession, readCashSession, recordCashSale, saveCashSession, type CashSession } from "@/lib/pos/cash-session";
import { createHeldSale, getHeldSales, removeHeldSale, upsertHeldSale, type HeldSale } from "@/lib/pos/held-sales";
import { boughtTogether, money, parseSmartLine, quickCash, recordSale, topPicks, whatsappUrl } from "@/lib/pos/smart";

type Product = { id: string; name: string; sku: string; barcode: string | null; price: number; vatRate: number; category: string; qty: number; imageUrl: string | null };
type CartItem = Product & { cartQty: number };
type Customer = { id: string; name: string; phone: string | null; email: string | null };
type Tender = "cash" | "card" | "mpesa" | "bank";
type ReceiptData = { date: string; customer: string; phone: string | null; amount: number; items: number; lines: Array<{ name: string; qty: number; total: number }>; receiptNumber: string; servedBy: string | null; staffRole: string | null; paymentMethod: string; tendered: number | null; change: number | null };

const tenders: Array<{ id: Tender; label: string; icon: LucideIcon }> = [
  { id: "cash", label: "Cash", icon: Banknote }, { id: "mpesa", label: "M-Pesa", icon: Smartphone },
  { id: "card", label: "Card", icon: CreditCard }, { id: "bank", label: "Bank", icon: Building2 },
];

async function fetchProducts(search: string, limit = 100): Promise<Product[]> {
  const response = await fetch(`/api/pos/products?limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`);
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error ?? "Failed to load products.");
  return result.data as Product[];
}

async function fetchProductPage(search: string, page: number, limit = 100): Promise<{ list: Product[]; count: number | null }> {
  const response = await fetch(`/api/pos/products?limit=${limit}&page=${page}${search ? `&search=${encodeURIComponent(search)}` : ""}`);
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error ?? "Failed to load products.");
  return { list: result.data as Product[], count: typeof result.count === "number" ? result.count : null };
}

export default function NewSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<Tender>("cash");
  const [splitPayment, setSplitPayment] = useState(false);
  const [splitTender, setSplitTender] = useState<Tender>("mpesa");
  const [splitAmount, setSplitAmount] = useState(0);
  const [tendered, setTendered] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [cashSession, setCashSession] = useState<CashSession>(() => createCashSession(0));
  const [sessionReady, setSessionReady] = useState(false);
  const [held, setHeld] = useState<HeldSale[]>([]);
  const [page, setPage] = useState(1);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const cartRef = useRef<CartItem[]>([]);
  const [picks, setPicks] = useState<string[]>([]);
  const [seenProducts, setSeenProducts] = useState<Map<string, Product>>(() => new Map());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (sessionReady) saveCashSession(cashSession); }, [cashSession, sessionReady]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCashSession(readCashSession());
      setSessionReady(true);
      setHeld(getHeldSales());
      const query = new URLSearchParams(window.location.search).get("q");
      if (query) {
        setSearch(query);
        window.history.replaceState(null, "", window.location.pathname);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { cartRef.current = cart; }, [cart]);

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
      try {
        const { list, count } = await fetchProductPage(search.trim(), 1);
        remember(list);
        setProducts(list);
        setPage(1);
        setProductCount(count);
        setPicks(topPicks());
      }
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
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/pos/customers?q=${encodeURIComponent(customerSearch)}`);
      if (response.ok) setCustomers((await response.json()).customers ?? []);
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
  const cashPortionForCurrentSale = paymentMethod === "cash"
    ? total - (splitPayment ? splitAmount : 0)
    : splitPayment && splitTender === "cash" ? splitAmount : 0;
  const change = paymentMethod === "cash" && !splitPayment && tendered > 0 ? tendered - total : null;

  const addToCart = useCallback((product: Product, qty = 1) => {
    if (product.qty < 1) return setMessage(`${product.name} is out of stock.`);
    const alreadyInCart = cartRef.current.find((item) => item.id === product.id)?.cartQty ?? 0;
    if (alreadyInCart + qty > product.qty) setMessage(`Only ${product.qty} of ${product.name} in stock.`);
    navigator.vibrate?.(12);
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      return existing ? current.map((item) => item.id === product.id ? { ...item, cartQty: Math.min(item.qty, item.cartQty + qty) } : item) : [...current, { ...product, cartQty: Math.min(product.qty, qty) }];
    });
  }, []);
  const updateQuantity = (id: string, quantity: number) => setCart((current) => quantity < 1 ? current.filter((item) => item.id !== id) : current.map((item) => item.id === id ? { ...item, cartQty: Math.min(item.qty, quantity) } : item));
  const clearSale = useCallback(() => { setCart([]); setCustomerName("Walk-in Customer"); setCustomerSearch(""); setSelectedCustomer(null); setCustomers([]); setSplitPayment(false); setSplitAmount(0); setTendered(0); }, []);

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

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { list, count } = await fetchProductPage(search.trim(), nextPage);
      remember(list);
      setProducts((current) => {
        const known = new Set(current.map((product) => product.id));
        return [...current, ...list.filter((product) => !known.has(product.id))];
      });
      setPage(nextPage);
      if (count !== null) setProductCount(count);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load more products.");
    } finally {
      setLoadingMore(false);
    }
  };

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
    if (cart.length) return setMessage("Finish or hold the current sale before recalling another.");
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
    if (processing || receipt) return;
    if (!cart.length) return setMessage("Cart is empty.");
    if (splitPayment && (splitTender === paymentMethod || splitAmount <= 0 || splitAmount >= total)) return setMessage("Choose a different second payment method and a valid amount.");
    if (change !== null && change < 0) return setMessage(`Cash received is Ksh ${Math.abs(change).toLocaleString()} short.`);
    const payload = {
      customerId: selectedCustomer?.id ?? null, customerName, subtotal, vat, total, paymentMethod,
      splitPayments: splitPayment ? [{ method: paymentMethod, amount: total - splitAmount }, { method: splitTender, amount: splitAmount }] : undefined,
      items: cart.map((item) => ({ productId: item.id, quantity: item.cartQty })),
    };
    const lines = cart.map((item) => ({ name: item.name, qty: item.cartQty, total: item.price * item.cartQty }));
    try {
      setProcessing(true); setMessage(null);
      const response = await fetch("/api/pos/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error ?? "Unable to complete sale.");
      setReceipt({ date: new Date(result.receipt.createdAt).toLocaleString(), customer: result.receipt.customer, phone: selectedCustomer?.phone ?? null, amount: Number(result.receipt.total), items: itemCount, lines, receiptNumber: result.receipt.receiptNumber, servedBy: result.receipt.servedBy, staffRole: result.receipt.staffRole, paymentMethod: result.receipt.paymentMethod, tendered: change !== null ? tendered : null, change });
      recordSale(cartIds);
      if (cashPortionForCurrentSale > 0 && cashSession.status === "open") {
        setCashSession((current) => recordCashSale(current, cashPortionForCurrentSale));
      }
      setProducts((current) => current.map((product) => { const sold = cart.find((item) => item.id === product.id); return sold ? { ...product, qty: product.qty - sold.cartQty } : product; }));
      clearSale();
    } catch (error) {
      if (!splitPayment && (!navigator.onLine || error instanceof TypeError)) {
        const id = await enqueueSale(payload); recordSale(cartIds); clearSale();
        setMessage(`Sale queued offline (${id.slice(0, 8)}). It will sync when connection returns.`);
      } else setMessage(error instanceof Error ? error.message : "Unable to complete sale.");
    } finally { setProcessing(false); }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "F8") { event.preventDefault(); void completeSale(); } if (event.key === "F4") { event.preventDefault(); holdSale(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const whatsapp = receipt ? whatsappUrl(receipt.phone, `Dantown Electrical receipt ${receipt.receiptNumber}\n${receipt.lines.map((l) => `${l.qty} x ${l.name} - ${money(l.total)}`).join("\n")}\nTotal: ${money(receipt.amount)} (${receipt.paymentMethod})\nThank you!`) : null;
  const renderTile = (product: Product, compact = false) => (
    <button type="button" key={product.id} className={`px-tile ${compact ? "compact" : ""} ${product.qty === 0 ? "out" : ""}`} onClick={() => addToCart(product)} disabled={!product.qty}>
      {!compact && <span className="px-tile-img">{product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <b>{product.name.charAt(0)}</b>}</span>}
      <span className="px-tile-name">{product.name}</span>
      <span className="px-tile-meta">{product.sku}</span>
      <span className="px-tile-foot"><strong>{money(product.price)}</strong><em className={product.qty === 0 ? "out" : product.qty <= 5 ? "low" : ""}>{product.qty === 0 ? "Out" : product.qty <= 5 ? `Only ${product.qty} left` : `${product.qty} in stock`}</em></span>
    </button>
  );

  return <div className="px-register">
    {message && <div className="px-toast" role="status"><AlertCircle size={18} /><span>{message}</span><button type="button" onClick={() => setMessage(null)} aria-label="Dismiss">×</button></div>}
    {receipt && <div className="px-modal"><div className="px-receipt px-receipt-print" role="dialog" aria-modal="true" aria-label="Sale complete">
      <Receipt size={34} className="px-receipt-icon" /><h2>Sale complete</h2><p className="px-receipt-no">{receipt.receiptNumber}</p><p className="px-receipt-amount">{money(receipt.amount)}</p>
      <div className="px-receipt-lines">{receipt.lines.map((line, index) => <p key={index}><span>{line.qty} × {line.name}</span><b>{money(line.total)}</b></p>)}</div>
      <div className="px-receipt-meta"><p>Customer <b>{receipt.customer}</b></p><p>Payment <b>{receipt.paymentMethod}</b></p>{receipt.change !== null && <p>Cash {money(receipt.tendered ?? 0)} · Change <b>{money(receipt.change)}</b></p>}{receipt.servedBy && <p>Served by <b>{receipt.servedBy}{receipt.staffRole ? ` · ${receipt.staffRole}` : ""}</b></p>}<p>{receipt.date}</p></div>
      <div className="px-receipt-actions"><button type="button" className="px-btn primary" onClick={() => window.print()}>Print</button>{whatsapp && <a className="px-btn" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>}<button type="button" className="px-btn" onClick={() => setReceipt(null)}>New sale</button></div>
    </div></div>}

    <section className="px-catalog">
      <div className="px-search">
        <Search size={18} />
        <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitSearch(); }} placeholder="Search, scan a barcode, or type “5 2.5mm cable”" aria-label="Search products" />
        <CameraBarcodeScanner onDetected={(code) => void scanBarcode(code)} />
      </div>
      <p className="px-hint"><Sparkles size={12} /> Smart entry adds the best match · <kbd>F2</kbd> search · <kbd>F4</kbd> hold · <kbd>F8</kbd> pay</p>
      {!search && pickProducts.length > 0 && <div className="px-picks"><h3>Your quick picks</h3><div>{pickProducts.map((product) => renderTile(product, true))}</div></div>}
      <div className="px-chips">{categories.map((name) => <button type="button" key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name}</button>)}</div>
      <div className="px-grid">{loading ? <p className="px-empty">Loading products...</p> : visible.length ? visible.map((product) => renderTile(product)) : <p className="px-empty">No products match “{search}”.</p>}</div>
      {!loading && productCount !== null && products.length < productCount && <button type="button" className="px-btn px-loadmore" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "Loading..." : `Show more products (${products.length} of ${productCount})`}</button>}
    </section>

    <aside className="px-cart" id="pos-cart-section">
      <div className="px-cart-head"><h2>Current sale</h2><div>
        {held.length > 0 && <details className="px-held"><summary><Play size={14} /> Held ({held.length})</summary><div className="px-held-list">{held.map((sale) => <div className="px-held-item" key={sale.id}><button type="button" className="px-held-recall" onClick={() => recallSale(sale)}><span>{sale.customerName} · {sale.cart.length} item{sale.cart.length === 1 ? "" : "s"}</span><small>{new Date(sale.updatedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</small></button><button type="button" className="px-held-remove" aria-label={`Remove held sale for ${sale.customerName}`} onClick={() => setHeld(removeHeldSale(sale.id))}><Trash2 size={14} /></button></div>)}</div></details>}
        {cart.length > 0 && <><button type="button" className="px-ghost" onClick={holdSale}><Pause size={14} /> Hold</button><button type="button" className="px-ghost" onClick={clearSale}>Clear</button></>}
      </div></div>

      <div className="px-lines">{cart.length === 0 ? <p className="px-empty"><ShoppingCart size={26} /><br />Scan or search to start a sale</p> : cart.map((item) => <div key={item.id} className="px-line">
        <div><strong>{item.name}</strong><small>{money(item.price)} each{item.cartQty >= item.qty ? " · max stock" : ""}</small></div>
        <b>{money(item.price * item.cartQty)}</b>
        <div className="px-qty"><button type="button" onClick={() => updateQuantity(item.id, item.cartQty - 1)} aria-label="Decrease"><Minus size={14} /></button><input type="number" min={1} max={item.qty} value={item.cartQty} onChange={(event) => updateQuantity(item.id, Number(event.target.value))} aria-label="Quantity" /><button type="button" onClick={() => updateQuantity(item.id, item.cartQty + 1)} aria-label="Increase"><Plus size={14} /></button><button type="button" className="danger" onClick={() => updateQuantity(item.id, 0)} aria-label="Remove"><Trash2 size={14} /></button></div>
      </div>)}</div>

      {together.length > 0 && <div className="px-together"><h3><Sparkles size={13} /> Often bought together</h3><div>{together.map((product) => <button type="button" key={product.id} onClick={() => addToCart(product)}>+ {product.name}<small>{money(product.price)}</small></button>)}</div></div>}

      {cart.length > 0 && <div className="px-checkout">
        <CashSessionPanel value={cashSession} onChange={setCashSession} />
        <div className="px-field"><input value={customerSearch} onChange={(event) => { setCustomerSearch(event.target.value); setCustomerName(event.target.value.trim() || "Walk-in Customer"); setSelectedCustomer(null); }} placeholder="Walk-in customer (type to find or name one)" aria-label="Customer" autoComplete="off" />
          {customers.length > 0 && <div className="px-dropdown">{customers.map((customer) => <button type="button" key={customer.id} onClick={() => { setSelectedCustomer(customer); setCustomerName(customer.name); setCustomerSearch(customer.name); setCustomers([]); }}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</button>)}</div>}</div>
        <div className="px-tenders">{tenders.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={paymentMethod === id ? "active" : ""} onClick={() => { setPaymentMethod(id); if (splitTender === id) setSplitTender(tenders.find((t) => t.id !== id)!.id); }}><Icon size={18} />{label}</button>)}</div>
        {paymentMethod === "cash" && !splitPayment && <div className="px-cash"><div className="px-quickcash">{quickCash(total).map((amount) => <button type="button" key={amount} className={tendered === amount ? "active" : ""} onClick={() => setTendered(amount)}>{amount === Math.ceil(total) ? "Exact" : amount.toLocaleString()}</button>)}</div>
          <input type="number" min={0} value={tendered || ""} onChange={(event) => setTendered(Number(event.target.value))} placeholder="Cash received" aria-label="Cash received" />
          {change !== null && <p className={`px-change ${change < 0 ? "short" : ""}`}>{change < 0 ? "Short" : "Change"} <b>{money(Math.abs(change))}</b></p>}</div>}
        <label className="px-split"><input type="checkbox" checked={splitPayment} onChange={(event) => { setSplitPayment(event.target.checked); if (event.target.checked && splitTender === paymentMethod) setSplitTender(tenders.find((tender) => tender.id !== paymentMethod)!.id); }} /> Split payment</label>
        {splitPayment && <div className="px-splitrow"><select value={splitTender} onChange={(event) => setSplitTender(event.target.value as Tender)} aria-label="Second tender">{tenders.filter((t) => t.id !== paymentMethod).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select><input type="number" min={0.01} step={0.01} value={splitAmount || ""} onChange={(event) => setSplitAmount(Number(event.target.value))} placeholder="Second amount" aria-label="Second amount" /></div>}
        <div className="px-totals"><p><span>Subtotal</span><b>{money(subtotal)}</b></p><p><span>VAT</span><b>{money(vat)}</b></p></div>
        <button type="button" className="px-pay" onClick={completeSale} disabled={processing}><span>{processing ? "Processing…" : "Charge"}</span><strong>{money(total)}</strong></button>
      </div>}
    </aside>
    {itemCount > 0 && <button type="button" className="px-mobile-cart" onClick={() => document.getElementById("pos-cart-section")?.scrollIntoView({ behavior: "smooth" })}><ShoppingCart size={18} /><span>View cart</span><strong>{itemCount} · {money(total)}</strong></button>}
  </div>;
}
