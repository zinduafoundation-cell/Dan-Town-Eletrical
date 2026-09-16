"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Minus, Plus, Receipt, Search, ShoppingCart, Trash2 } from "lucide-react";
import { CameraBarcodeScanner } from "@/components/pos/camera-barcode-scanner";
import { enqueueSale } from "@/lib/pos/offline-queue";
import { matchesPOSProduct } from "@/lib/pos/product-search";

type Product = { id: string; name: string; sku: string; barcode: string | null; price: number; vatRate: number; category: string; qty: number };
type CartItem = Product & { cartQty: number };
type Customer = { id: string; name: string; phone: string | null; email: string | null };
type Tender = "cash" | "card" | "mpesa" | "bank";
type ReceiptData = { date: string; customer: string; amount: number; items: number; receiptNumber: string; servedBy: string | null; staffRole: string | null; paymentMethod: string };

const money = (amount: number) => `Ksh ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function NewSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All products");
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<Tender>("cash");
  const [splitPayment, setSplitPayment] = useState(false);
  const [splitTender, setSplitTender] = useState<Tender>("mpesa");
  const [splitAmount, setSplitAmount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/pos/products");
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error ?? "Failed to load products.");
      setProducts(result.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchProducts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const listener = (event: Event) => {
      window.setTimeout(() => setSearch((event as CustomEvent<string>).detail), 0);
    };
    window.addEventListener("dantown-pos-search", listener);
    return () => window.removeEventListener("dantown-pos-search", listener);
  }, []);
  useEffect(() => {
    if (customerSearch.trim().length < 2) {
      const timer = window.setTimeout(() => setCustomers([]), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/pos/customers?q=${encodeURIComponent(customerSearch)}`);
      if (response.ok) setCustomers((await response.json()).customers ?? []);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  const categories = useMemo(() => ["All products", ...Array.from(new Set(products.map((product) => product.category))).sort()], [products]);
  const visibleProducts = useMemo(() => products.filter((product) => matchesPOSProduct(product, search) && (category === "All products" || product.category === category)), [products, search, category]);
  const subtotal = cart.reduce((total, item) => total + item.price * item.cartQty, 0);
  const vat = cart.reduce((total, item) => total + Math.round(item.price * item.cartQty * item.vatRate) / 100, 0);
  const total = subtotal + vat;
  const itemCount = cart.reduce((count, item) => count + item.cartQty, 0);

  const addToCart = (product: Product) => {
    if (product.qty < 1) return;
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      return existing
        ? current.map((item) => item.id === product.id ? { ...item, cartQty: Math.min(item.qty, item.cartQty + 1) } : item)
        : [...current, { ...product, cartQty: 1 }];
    });
  };
  const updateQuantity = (productId: string, quantity: number) => setCart((current) => quantity < 1 ? current.filter((item) => item.id !== productId) : current.map((item) => item.id === productId ? { ...item, cartQty: Math.min(item.qty, quantity) } : item));
  const clearSale = () => {
    setCart([]); setCustomerName("Walk-in Customer"); setCustomerSearch(""); setSelectedCustomer(null);
    setCustomers([]); setSplitPayment(false); setSplitAmount(0);
  };
  const scanBarcode = (barcode: string) => {
    const code = barcode.trim().toLowerCase();
    const product = products.find((item) => item.barcode?.trim().toLowerCase() === code);
    if (!product) return setMessage("No product matched that barcode.");
    addToCart(product); setSearch("");
  };

  const completeSale = async () => {
    if (!cart.length) return setMessage("Cart is empty.");
    if (splitPayment && (splitTender === paymentMethod || splitAmount <= 0 || splitAmount >= total)) return setMessage("Choose a different second payment method and a valid amount.");
    const payload = {
      customerId: selectedCustomer?.id ?? null, customerName, subtotal, vat, total,
      paymentMethod: splitPayment ? paymentMethod : paymentMethod,
      splitPayments: splitPayment ? [{ method: paymentMethod, amount: total - splitAmount }, { method: splitTender, amount: splitAmount }] : undefined,
      items: cart.map((item) => ({ productId: item.id, quantity: item.cartQty })),
    };
    try {
      setProcessing(true); setMessage(null);
      const response = await fetch("/api/pos/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error ?? "Unable to complete sale.");
      setReceipt({ date: new Date(result.receipt.createdAt).toLocaleString(), customer: result.receipt.customer, amount: Number(result.receipt.total), items: itemCount, receiptNumber: result.receipt.receiptNumber, servedBy: result.receipt.servedBy, staffRole: result.receipt.staffRole, paymentMethod: result.receipt.paymentMethod });
      setProducts((current) => current.map((product) => { const sold = cart.find((item) => item.id === product.id); return sold ? { ...product, qty: product.qty - sold.cartQty } : product; }));
      clearSale();
    } catch (error) {
      if (!splitPayment && (!navigator.onLine || error instanceof TypeError)) {
        const id = await enqueueSale(payload);
        clearSale(); setMessage(`Sale queued offline (${id.slice(0, 8)}). It will sync when connection returns.`);
      } else setMessage(error instanceof Error ? error.message : "Unable to complete sale.");
    } finally { setProcessing(false); }
  };

  return <div className="pos-new-sale">
    {message && <div className="pos-error-toast"><AlertCircle size={20} /><span>{message}</span><button type="button" onClick={() => setMessage(null)} className="pos-error-close" aria-label="Dismiss">×</button></div>}
    {receipt && <div className="pos-receipt-modal"><div className="pos-receipt-card"><Receipt size={48} className="pos-receipt-icon" /><h2>Sale complete</h2><p className="pos-receipt-number">{receipt.receiptNumber}</p><p className="pos-receipt-amount">{money(receipt.amount)}</p><div className="pos-receipt-details"><p>Customer: <strong>{receipt.customer}</strong></p><p>Items: <strong>{receipt.items}</strong></p><p>Time: <strong>{receipt.date}</strong></p><p>Payment: <strong>{receipt.paymentMethod}</strong></p>{receipt.servedBy && <p>Served by: <strong>{receipt.servedBy}</strong></p>}</div><button type="button" className="button button-primary" onClick={() => window.print()}>Print receipt</button><button type="button" className="pos-clear-button" onClick={() => setReceipt(null)}>Close</button></div></div>}
    <div className="pos-new-sale-container">
      <section className="pos-products-section"><div className="pos-products-header"><h2>Products</h2><div className="pos-search-wrapper"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") scanBarcode(event.currentTarget.value); }} className="pos-products-search" placeholder="Search name, SKU or scan barcode..." aria-label="Search products" /><CameraBarcodeScanner onDetected={scanBarcode} /></div><div className="pos-category-filters">{categories.map((name) => <button type="button" key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name}</button>)}</div></div>
        <div className="pos-products-grid">{loading ? <div className="pos-loading">Loading products...</div> : visibleProducts.map((product) => <div key={product.id} className={`pos-product-card ${product.qty === 0 ? "out-of-stock" : ""}`}><div className="pos-product-info"><div className="pos-product-name">{product.name}</div><div className="pos-product-meta">{product.sku} · {product.qty} in stock</div></div><div className="pos-product-price">{money(product.price)}</div><button type="button" onClick={() => addToCart(product)} disabled={!product.qty} className="pos-product-button">{product.qty ? "Add" : "Out"}</button></div>)}</div>
      </section>
      <section className="pos-cart-section" id="pos-cart-section"><div className="pos-cart-header"><h2>Sale order</h2>{cart.length > 0 && <button type="button" onClick={clearSale} className="pos-clear-button">Clear</button>}</div><div className="pos-cart-items">{cart.length === 0 ? <div className="pos-cart-empty">Cart is empty</div> : cart.map((item) => <div key={item.id} className="pos-cart-item"><div className="pos-cart-item-info"><div className="pos-cart-item-name">{item.name}</div><div className="pos-cart-item-price">{money(item.price)} each</div></div><div className="pos-cart-item-controls"><button type="button" onClick={() => updateQuantity(item.id, item.cartQty - 1)} className="pos-qty-button"><Minus size={14} /></button><input type="number" min="1" max={item.qty} value={item.cartQty} onChange={(event) => updateQuantity(item.id, Number(event.target.value))} className="pos-qty-input" /><button type="button" onClick={() => updateQuantity(item.id, item.cartQty + 1)} className="pos-qty-button"><Plus size={14} /></button><div className="pos-cart-item-total">{money(item.price * item.cartQty)}</div><button type="button" onClick={() => updateQuantity(item.id, 0)} className="pos-remove-button"><Trash2 size={16} /></button></div></div>)}</div>
        {cart.length > 0 && <div className="pos-checkout-section"><div className="pos-cart-totals"><div className="pos-total-line"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div className="pos-total-line"><span>VAT</span><strong>{money(vat)}</strong></div><div className="pos-total-line pos-grand-total"><span>Total</span><strong>{money(total)}</strong></div></div><div className="pos-form-group"><label>Customer</label><input value={customerSearch || customerName} onChange={(event) => { setCustomerSearch(event.target.value); setCustomerName(event.target.value || "Walk-in Customer"); setSelectedCustomer(null); }} className="pos-input" placeholder="Search customer or leave empty" />{customers.length > 0 && <div className="pos-dropdown">{customers.map((customer) => <button type="button" key={customer.id} className="pos-dropdown-item" onClick={() => { setSelectedCustomer(customer); setCustomerName(customer.name); setCustomerSearch(customer.name); setCustomers([]); }}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</button>)}</div>}</div><div className="pos-form-group"><label>Payment method</label><div className="pos-payment-methods">{(["cash", "card", "mpesa", "bank"] as Tender[]).map((method) => <button type="button" key={method} onClick={() => setPaymentMethod(method)} className={`pos-payment-button ${paymentMethod === method ? "active" : ""}`}>{method.toUpperCase()}</button>)}</div></div><label className="pos-split-toggle"><input type="checkbox" checked={splitPayment} onChange={(event) => setSplitPayment(event.target.checked)} /> Split payment</label>{splitPayment && <div className="pos-split-payment"><label>Second tender <select className="pos-input" value={splitTender} onChange={(event) => setSplitTender(event.target.value as Tender)}>{(["cash", "card", "mpesa", "bank"] as Tender[]).filter((method) => method !== paymentMethod).map((method) => <option key={method} value={method}>{method.toUpperCase()}</option>)}</select></label><label>Second amount <input className="pos-input" type="number" min="0.01" max={Math.max(0.01, total - 0.01)} step="0.01" value={splitAmount || ""} onChange={(event) => setSplitAmount(Number(event.target.value))} /></label></div>}<button type="button" onClick={completeSale} disabled={processing} className="pos-pay-button">{processing ? "Processing..." : "Complete sale"}</button></div>}</section>
    </div>
    <button type="button" className="pos-mobile-cart-button" onClick={() => document.getElementById("pos-cart-section")?.scrollIntoView({ behavior: "smooth" })}><ShoppingCart size={18} /><span>View cart</span><strong>{itemCount} item{itemCount === 1 ? "" : "s"} · {money(total)}</strong></button>
  </div>;
}
