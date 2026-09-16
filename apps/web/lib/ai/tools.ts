import type { AuthorizationContext } from "@dantown/auth";
import { hasPermission } from "@dantown/auth";
import { getCatalogCategories, getCatalogProducts, getPublishedKnowledge } from "@dantown/database";
import { getCustomerOrders, getCustomerQuotes } from "@dantown/database";
import type { Permission } from "@dantown/shared";
import { createSupabaseServerClient } from "../supabase/server";
import { classifyQuestion } from "./intent";
import { isSurfaceAllowed, isSurfaceIntentAllowed, type AiSurface } from "./surface";

export type AiToolResult = { tool: string; data: unknown };

function requires(context: AuthorizationContext | null, permission: Permission) {
  return Boolean(context && hasPermission(context, permission));
}

async function getSurfaceBusinessSummary(client: Awaited<ReturnType<typeof createSupabaseServerClient>>, surface: AiSurface) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [{ data: ordersToday }, { data: inventory }, { data: payments }, { data: syncRecords }] = await Promise.all([
    client.from("orders").select("id, total, payment_status, order_status, sales_channel").gte("created_at", start.toISOString()),
    client.from("inventory").select("quantity, reserved_quantity, reorder_level"),
    client.from("payments").select("amount, status, created_at").gte("created_at", start.toISOString()),
    client.from("pos_sync_records").select("status, retry_count, error_message")
  ]);

  const successfulToday = (payments ?? []).filter((payment) => payment.status === "SUCCESS");
  const revenueToday = successfulToday.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const lowStock = (inventory ?? []).filter((row) => Number(row.quantity || 0) - Number(row.reserved_quantity || 0) <= Number(row.reorder_level || 0)).length;
  const pendingSync = (syncRecords ?? []).filter((record) => ["PENDING", "SYNCING"].includes(record.status)).length;
  const failedSync = (syncRecords ?? []).filter((record) => record.status === "FAILED").length;
  const pendingOrders = (ordersToday ?? []).filter((order) => ["PENDING", "PAYMENT_PENDING", "PROCESSING"].includes(order.order_status)).length;
  const posSales = (ordersToday ?? []).filter((order) => order.sales_channel === "POS" && order.payment_status === "SUCCESS").reduce((sum, order) => sum + Number(order.total || 0), 0);
  return {
    surface,
    summary: {
      revenueToday,
      lowStock,
      pendingOrders,
      pendingSync,
      failedSync,
      posSales,
      totalOrders: ordersToday?.length ?? 0,
      totalPayments: payments?.length ?? 0
    }
  };
}

export async function runApprovedTool(question: string, context: AuthorizationContext | null, surface: AiSurface = "storefront"): Promise<AiToolResult> {
  const client = await createSupabaseServerClient();
  const intent = classifyQuestion(question);

  if (!isSurfaceIntentAllowed(surface, intent)) {
    return { tool: "authorization", data: `This question is not available on the ${surface} surface.` };
  }

  if (intent === "products") {
    const products = await getCatalogProducts(client, { search: question, allowFallback: false });
    return { tool: "searchProducts", data: products.slice(0, 8).map((product) => ({ name: product.name, sku: product.sku, slug: product.slug, price: product.promotional_price ?? product.retail_price, description: product.short_description })) };
  }

  if (intent === "categories") {
    return { tool: "getCategories", data: await getCatalogCategories(client) };
  }

  if (intent === "business") {
    const knowledge = await getPublishedKnowledge(client, question);
    return { tool: "approvedKnowledge", data: knowledge.entries.length ? knowledge.entries.map((entry) => ({ title: entry.title, category: entry.category, content: entry.content })) : { business: "Dantown Electrical", location: "Kitale, Kenya", contact: "Use the Contact page on the Dantown website.", payments: "Available payment methods are shown during checkout and are subject to confirmation." } };
  }

  if (intent === "inventory") {
    const products = await getCatalogProducts(client, { search: question, allowFallback: false });
    const productIds = products.slice(0, 8).map((product) => product.id);
    const serviceClient = (await import("../supabase/server")).createSupabaseServiceClient();
    const { data } = productIds.length ? await serviceClient.from("inventory").select("product_id, quantity, reserved_quantity").in("product_id", productIds) : { data: [] };
    return { tool: "getProductAvailability", data: products.slice(0, 8).map((product) => ({ name: product.name, sku: product.sku, available: (data ?? []).filter((row) => row.product_id === product.id).reduce((total, row) => total + Math.max(0, Number(row.quantity ?? 0) - Number(row.reserved_quantity ?? 0)), 0) })) };
  }

  if (!context) return { tool: "authorization", data: "Sign in to access private order information." };

  if (intent === "orders") {
    if (surface !== "storefront" && !isSurfaceAllowed(surface, context)) {
      return { tool: "authorization", data: "You do not have access to that surface." };
    }
    const { data: customer } = await client.from("customers").select("id").eq("user_id", context.userId).maybeSingle();
    if (!customer) return { tool: "getMyOrders", data: [] };
    const { data, error } = await getCustomerOrders(client, customer.id);
    return { tool: "getMyOrders", data: error ? [] : (data ?? []).map((order) => ({ orderNumber: order.order_number, status: order.order_status, paymentStatus: order.payment_status, total: order.total, createdAt: order.created_at })) };
  }

  if (intent === "sales") {
    if (!requires(context, "reports.read")) return { tool: "authorization", data: "You are not authorized to access that business information." };
    const { data, error } = await client.from("orders").select("total, payment_status, sales_channel, created_at").eq("payment_status", "SUCCESS").limit(100);
    return { tool: "getSalesSummary", data: error ? [] : data ?? [] };
  }

  if (intent === "quotes") {
    const { data: customer } = await client.from("customers").select("id").eq("user_id", context.userId).maybeSingle();
    if (!customer) return { tool: "getMyQuotationStatus", data: [] };
    const { data, error } = await getCustomerQuotes(client, customer.id);
    return { tool: "getMyQuotationStatus", data: error ? [] : (data ?? []).map((quote) => ({ quoteNumber: quote.quote_number, status: quote.status, total: quote.total })) };
  }

  if (surface === "centre" || surface === "admin") {
    return { tool: "getBusinessSummary", data: await getSurfaceBusinessSummary(client, surface) };
  }

  return { tool: "authorization", data: "That information is not available for this account." };
}