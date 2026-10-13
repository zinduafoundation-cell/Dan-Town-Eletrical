import Link from "next/link";
import { PortalShell } from "@/app/portal-shell";
import { requireAuthorizedPermission } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { PaymentStatus } from "@dantown/database";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "PROCESSING", "SUCCESS", "FAILED", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"];
const PAYMENT_METHODS = ["MPESA", "CASH", "CARD", "BANK_TRANSFER", "PAY_ON_PICKUP", "COD"] as const;
const PROVIDERS = ["PAYWAVE_EXPRESS", "PAYSTACK"] as const;
const safeSearch = /^[a-zA-Z0-9._/-]{1,100}$/;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export default async function PaymentDashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireAuthorizedPermission("payments.read");
  const params = await searchParams;
  const status = PAYMENT_STATUSES.includes(getValue(params.status) as PaymentStatus) ? getValue(params.status) as PaymentStatus : "";
  const method = PAYMENT_METHODS.find((item) => item === getValue(params.method)) ?? "";
  const provider = PROVIDERS.includes(getValue(params.provider) as typeof PROVIDERS[number]) ? getValue(params.provider) : "";
  const search = safeSearch.test(getValue(params.search)) ? getValue(params.search) : "";
  const from = validDate(getValue(params.from));
  const toDate = validDate(getValue(params.to));
  const to = toDate ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000) : null;
  const cursorValue = getValue(params.cursor);
  const [cursorDate, cursorId] = cursorValue.split("|");
  const validCursor = cursorDate && !Number.isNaN(Date.parse(cursorDate)) && /^[0-9a-f-]{36}$/i.test(cursorId ?? "")
    ? { date: new Date(cursorDate).toISOString(), id: cursorId }
    : null;

  const supabase = createSupabaseServiceClient();
  let matchingPaymentIds: string[] | null = null;
  if (search) {
    const [{ data: matchingOrders, error: orderSearchError }, { data: matchingTransactions, error: transactionSearchError }] = await Promise.all([
      supabase.from("orders").select("id").eq("order_number", search).limit(1),
      supabase.from("payment_transactions")
        .select("payment_id")
        .or(`provider_reference.eq.${search},checkout_request_id.eq.${search}`)
        .limit(2),
    ]);
    if (orderSearchError) throw orderSearchError;
    if (transactionSearchError) throw transactionSearchError;
    const matchingOrderIds = (matchingOrders ?? []).map((order) => order.id);
    const { data: orderPayments, error: orderPaymentsError } = matchingOrderIds.length
      ? await supabase.from("payments").select("id").in("order_id", matchingOrderIds).limit(100)
      : { data: [], error: null };
    if (orderPaymentsError) throw orderPaymentsError;
    matchingPaymentIds = [...new Set([
      ...(orderPayments ?? []).map((payment) => payment.id),
      ...(matchingTransactions ?? []).map((transaction) => transaction.payment_id),
    ])];
  }

  let paymentQuery = supabase.from("payments")
    .select("id,order_id,method,status,amount,currency,provider,created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (status) paymentQuery = paymentQuery.eq("status", status);
  if (method) paymentQuery = paymentQuery.eq("method", method);
  if (provider) paymentQuery = paymentQuery.eq("provider", provider);
  if (from) paymentQuery = paymentQuery.gte("created_at", from.toISOString());
  if (to) paymentQuery = paymentQuery.lt("created_at", to.toISOString());
  if (matchingPaymentIds) {
    if (matchingPaymentIds.length) paymentQuery = paymentQuery.in("id", matchingPaymentIds);
    else paymentQuery = paymentQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  }
  if (validCursor) {
    paymentQuery = paymentQuery.or(`created_at.lt.${validCursor.date},and(created_at.eq.${validCursor.date},id.lt.${validCursor.id})`);
  }
  const { data: rawPayments, error: paymentsError } = await paymentQuery;
  if (paymentsError) throw paymentsError;
  const payments = rawPayments ?? [];
  const hasMore = payments.length > PAGE_SIZE;
  const page = payments.slice(0, PAGE_SIZE);
  const orderIds = [...new Set(page.map((payment) => payment.order_id))];
  const paymentIds = page.map((payment) => payment.id);
  const [{ data: orders, error: ordersError }, { data: transactions, error: transactionsError }] = await Promise.all([
    orderIds.length ? supabase.from("orders").select("id,order_number,customer_id").in("id", orderIds) : Promise.resolve({ data: [], error: null }),
    paymentIds.length ? supabase.from("payment_transactions").select("id,payment_id,provider_reference,checkout_request_id,merchant_request_id,result_description,processed_at,created_at").in("payment_id", paymentIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (ordersError) throw ordersError;
  if (transactionsError) throw transactionsError;
  const customerIds = [...new Set((orders ?? []).map((order) => order.customer_id).filter((id): id is string => Boolean(id)))];
  const { data: customers, error: customersError } = customerIds.length
    ? await supabase.from("customers").select("id,name,phone").in("id", customerIds)
    : { data: [], error: null };
  if (customersError) throw customersError;

  const ordersById = new Map((orders ?? []).map((order) => [order.id, order]));
  const customersById = new Map((customers ?? []).map((customer) => [customer.id, customer]));
  const latestTransaction = new Map<string, NonNullable<typeof transactions>[number]>();
  for (const transaction of transactions ?? []) {
    if (!latestTransaction.has(transaction.payment_id)) latestTransaction.set(transaction.payment_id, transaction);
  }
  const currentPageAmount = page.reduce((total, payment) => total + Number(payment.amount), 0);
  const filters = new URLSearchParams();
  for (const [key, value] of Object.entries({ status, method, provider, search, from: getValue(params.from), to: getValue(params.to) })) {
    if (value) filters.set(key, value);
  }
  const nextCursor = page.length ? `${page[page.length - 1].created_at}|${page[page.length - 1].id}` : "";
  const nextHref = `/admin/payments?${filters.toString()}&cursor=${encodeURIComponent(nextCursor)}`;

  return (
    <PortalShell
      title="Payments."
      description="Search confirmed and pending payments, provider references, and order links."
      roles={context.roles}
      permissions={context.permissions}
      wide
      links={[
        { label: "Overview", href: "/admin" },
        { label: "Orders", href: "/admin/orders", permission: "orders.read" },
        { label: "POS", href: "/pos", permission: "orders.read" },
        { label: "Payments", href: "/admin/payments", permission: "payments.read" },
      ]}
    >
      <section className="payment-dashboard">
        <div className="payment-dashboard-summary">
          <strong>{page.length}</strong><span>shown</span>
          <strong>KSh {currentPageAmount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</strong><span>on this page</span>
        </div>
        <form className="payment-dashboard-filters" action="/admin/payments" method="get">
            <label>Exact order / provider reference<input name="search" defaultValue={search} maxLength={100} placeholder="Paste an order number or transaction reference" /></label>
          <label>Status<select name="status" defaultValue={status}><option value="">All statuses</option>{PAYMENT_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Method<select name="method" defaultValue={method}><option value="">All methods</option>{PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Provider<select name="provider" defaultValue={provider}><option value="">All providers</option>{PROVIDERS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>From<input type="date" name="from" defaultValue={getValue(params.from)} /></label>
          <label>To<input type="date" name="to" defaultValue={getValue(params.to)} /></label>
          <button className="button button-primary" type="submit">Search payments</button>
        </form>
        <div className="payment-dashboard-table-wrap">
          <table className="payment-dashboard-table">
            <thead><tr><th>Time</th><th>Order</th><th>Customer</th><th>Method / provider</th><th>Amount</th><th>Status</th><th>Provider reference</th></tr></thead>
            <tbody>
              {page.map((payment) => {
                const order = ordersById.get(payment.order_id);
                const customer = order?.customer_id ? customersById.get(order.customer_id) : null;
                const transaction = latestTransaction.get(payment.id);
                return <tr key={payment.id}>
                  <td>{new Date(payment.created_at).toLocaleString("en-KE")}</td>
                  <td>{order ? <Link href="/admin/orders">{order.order_number}</Link> : "Order unavailable"}</td>
                  <td>{customer ? <>{customer.name}<small>{customer.phone ?? ""}</small></> : "Walk-in / guest"}</td>
                  <td>{payment.method}<small>{payment.provider ?? "Manual / POS"}</small></td>
                  <td>{payment.currency} {Number(payment.amount).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</td>
                  <td><span className={`payment-status-badge status-${payment.status.toLowerCase()}`}>{payment.status}</span></td>
                  <td>{transaction?.provider_reference ?? transaction?.checkout_request_id ?? transaction?.merchant_request_id ?? "—"}{transaction?.result_description && <small>{transaction.result_description}</small>}</td>
                </tr>;
              })}
              {!page.length && <tr><td colSpan={7}>No payments matched those filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="payment-dashboard-pagination">
          <span>{hasMore ? "Showing 50 results; narrow the search to find a payment." : `Showing ${page.length} matching payments`} · maximum 50 per page</span>
          {hasMore && <Link className="button button-secondary" href={nextHref}>Next 50</Link>}
        </div>
      </section>
    </PortalShell>
  );
}
