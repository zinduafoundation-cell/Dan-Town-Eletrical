import type { AuthorizationContext } from "@dantown/auth";
import { hasPermission } from "@dantown/auth";
import { getCatalogCategories, getCatalogProducts, getPublishedKnowledge } from "@dantown/database";
import { getCustomerOrders, getCustomerQuotes } from "@dantown/database";
import type { Database } from "@dantown/database";
import type { Permission } from "@dantown/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "../supabase/server";
import { getCentreMetrics } from "../centre/metrics";
import { classifyQuestion } from "./intent";
import { isSurfaceAllowed, isSurfaceIntentAllowed, type AiSurface } from "./surface";
import { searchSettingsCategories } from "../settings/categories";
import { loadBusinessConfiguration } from "../settings/business-configuration";
import { summarizePaymentRecords } from "./payment-summary";
import { extractEntitySearchTerm, extractQuoteNumber, formatDateInTimeZone, requestedDocumentTypes } from "./document-query";

export type AiToolResult = { tool: string; data: unknown };

function requires(context: AuthorizationContext | null, permission: Permission) {
  return Boolean(context && hasPermission(context, permission));
}

async function getVerifiedPaymentSummary(serviceClient: SupabaseClient<Database>, since: string) {
  const [{ data: payments, error: paymentsError }, { data: refunds, error: refundsError }] = await Promise.all([
    serviceClient
      .from("payments")
      .select("id,amount,method,status,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100),
    serviceClient
      .from("refunds")
      .select("payment_id,amount,status,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (paymentsError) throw paymentsError;
  if (refundsError) throw refundsError;
  const refundPaymentIds = [...new Set((refunds ?? []).map((refund) => refund.payment_id))];
  const { data: refundPayments, error: refundPaymentsError } = refundPaymentIds.length
    ? await serviceClient.from("payments").select("id,method").in("id", refundPaymentIds)
    : { data: [], error: null };
  if (refundPaymentsError) throw refundPaymentsError;
  const refundMethods = new Map((refundPayments ?? []).map((payment) => [payment.id, payment.method]));
  return summarizePaymentRecords(
    payments ?? [],
    (refunds ?? []).map((refund) => ({
      paymentId: refund.payment_id,
      amount: Number(refund.amount),
      status: refund.status,
    })),
    refundMethods,
  );
}

async function getSurfaceBusinessSummary(surface: AiSurface, permissions: Permission[]) {
  const { metrics, source } = await getCentreMetrics(permissions);
  return {
    surface,
    source,
    summary: {
      revenueToday: metrics.revenueToday,
      lowStock: metrics.lowStock,
      pendingOrders: metrics.pendingOrders,
      pendingPayments: metrics.pendingPayments,
      pendingSync: metrics.pendingSync,
      failedSync: metrics.failedSync,
      posSales: metrics.posSalesToday,
      totalOrders: metrics.ordersToday,
      eventDeliveryRisks: metrics.retryDomainEvents + metrics.deadLetterDomainEvents,
    },
  };
}

export async function runApprovedTool(question: string, context: AuthorizationContext | null, surface: AiSurface = "storefront"): Promise<AiToolResult> {
  const client = await createSupabaseServerClient();
  const intent = classifyQuestion(question);

  if (!isSurfaceIntentAllowed(surface, intent)) {
    return { tool: "authorization", data: `This question is not available on the ${surface} surface.` };
  }

  if (intent === "settings") {
    if (!context) return { tool: "authorization", data: "Sign in to search business settings." };
    if (/\b(profile|numbering|document template|business name)\b/i.test(question) && requires(context, "settings.manage")) {
      const { documentSettings } = await loadBusinessConfiguration();
      return {
        tool: "get_setting",
        data: {
          setting: "shared business document profile",
          businessName: documentSettings.businessName,
          businessCode: documentSettings.businessCode,
          financialYearStartMonth: documentSettings.financialYearStartMonth,
          country: documentSettings.country,
          timeZone: documentSettings.timeZone,
          dateLocale: documentSettings.dateLocale,
        },
      };
    }
    const matches = searchSettingsCategories(question).map((category) => ({
      category: category.title,
      description: category.description,
      links: category.links
        .filter((link) => !link.permission || context.permissions.includes(link.permission))
        .map(({ label, href }) => ({ label, href })),
    }));
    return { tool: "search_settings", data: matches };
  }

  if (intent === "documents") {
    if (!context) {
      return { tool: "authorization", data: "Sign in to search your receipts." };
    }
    if (surface !== "storefront" && !isSurfaceAllowed(surface, context)) {
      return { tool: "authorization", data: "You do not have access to that assistant surface." };
    }
    const serviceClient = (await import("../supabase/server")).createSupabaseServiceClient();
    const documentNumber = question.match(/\b[A-Z0-9]{2,8}-[A-Z0-9]{1,8}-\d{4}-\d{4,}\b/i)?.[0];
    if (surface === "storefront") {
      const { data: customer, error: customerError } = await client
        .from("customers")
        .select("id")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (customerError) throw customerError;
      if (!customer) return { tool: "search_my_receipts", data: [] };
      const { data: orders, error: ordersError } = await client
        .from("orders")
        .select("id")
        .eq("customer_id", customer.id)
        .limit(100);
      if (ordersError) throw ordersError;
      const orderIds = (orders ?? []).map((order) => order.id);
      if (!orderIds.length) return { tool: "search_my_receipts", data: [] };
      const { data: payments, error: paymentsError } = await serviceClient
        .from("payments")
        .select("id")
        .in("order_id", orderIds)
        .in("status", ["SUCCESS", "PARTIALLY_REFUNDED", "REFUNDED"])
        .limit(100);
      if (paymentsError) throw paymentsError;
      const receiptReferences = (payments ?? []).map((payment) => `PAYMENT:${payment.id}`);
      if (!receiptReferences.length) return { tool: "search_my_receipts", data: [] };
      let receiptQuery = serviceClient
        .from("business_documents")
        .select("document_number,document_type,document_status,issue_date,total,currency")
        .eq("document_type", "RECEIPT")
        .in("related_reference", receiptReferences)
        .order("created_at", { ascending: false })
        .limit(20);
      if (documentNumber) receiptQuery = receiptQuery.eq("document_number", documentNumber);
      const { data, error } = await receiptQuery;
      if (error) throw error;
      return {
        tool: documentNumber ? "get_my_receipt" : "search_my_receipts",
        data: (data ?? []).map((document) => ({
          documentNumber: document.document_number,
          type: document.document_type,
          status: document.document_status,
          issueDate: document.issue_date,
          total: Number(document.total),
          currency: document.currency,
        })),
      };
    }
    if ((surface !== "admin" && surface !== "centre") || !requires(context, "settings.manage")) {
      return { tool: "authorization", data: "You are not authorized to search business documents." };
    }
    let query = serviceClient
      .from("business_documents")
      .select("document_number,document_type,document_title,document_status,issue_date,due_date,total,currency,related_reference")
      .order("created_at", { ascending: false });
    query = documentNumber
      ? query.eq("document_number", documentNumber).limit(1)
      : query.limit(10);
    const typeFilter = requestedDocumentTypes(question);
    if (typeFilter) query = query.in("document_type", typeFilter);
    const overdueOnly = /\boverdue\b|\bpast[- ]due\b/i.test(question);
    if (overdueOnly) {
      const { documentSettings } = await loadBusinessConfiguration();
      query = query.lt("due_date", formatDateInTimeZone(new Date(), documentSettings.timeZone));
      for (const status of ["DRAFT", "CANCELLED", "REVERSED", "ARCHIVED"] as const) {
        query = query.neq("document_status", status);
      }
    }
    const { data, error } = await query;
    if (error) throw error;
    if (overdueOnly) {
      const references = [...new Set((data ?? []).map((document) => document.related_reference).filter((reference): reference is string => Boolean(reference)))];
      const { data: linkedOrders, error: linkedOrdersError } = references.length
        ? await serviceClient.from("orders").select("order_number,payment_status").in("order_number", references)
        : { data: [], error: null };
      if (linkedOrdersError) throw linkedOrdersError;
      const paymentStatusByOrder = new Map((linkedOrders ?? []).map((order) => [order.order_number, order.payment_status]));
      return {
        tool: "get_overdue_documents",
        data: (data ?? []).map((document) => ({
          documentNumber: document.document_number,
          type: document.document_type,
          status: document.document_status,
          dueDate: document.due_date,
          total: Number(document.total),
          currency: document.currency,
          linkedOrderPaymentStatus: document.related_reference
            ? paymentStatusByOrder.get(document.related_reference) ?? "not verified in linked order records"
            : "not linked to an order",
        })),
      };
    }
    return {
      tool: documentNumber ? "get_document" : "search_documents",
      data: (data ?? []).map((document) => ({
        documentNumber: document.document_number,
        type: document.document_type,
        title: document.document_title,
        status: document.document_status,
        issueDate: document.issue_date,
        dueDate: document.due_date,
        total: Number(document.total),
        currency: document.currency,
        relatedReference: document.related_reference,
      })),
    };
  }

  if (intent === "customers") {
    if (!context || (surface !== "admin" && surface !== "centre") || !requires(context, "customers.read")) {
      return { tool: "authorization", data: "You are not authorized to search customer records." };
    }
    const searchTerm = extractEntitySearchTerm(question, "customer");
    if (!searchTerm) return { tool: "search_customers", data: { message: "Enter a customer name to search.", customers: [] } };
    const serviceClient = (await import("../supabase/server")).createSupabaseServiceClient();
    const { data, error } = await serviceClient
      .from("customers")
      .select("name,customer_type,status")
      .ilike("name", `%${searchTerm}%`)
      .order("name")
      .limit(10);
    if (error) throw error;
    return { tool: "search_customers", data: data ?? [] };
  }

  if (intent === "suppliers") {
    if (!context || (surface !== "admin" && surface !== "centre") || !requires(context, "products.read")) {
      return { tool: "authorization", data: "You are not authorized to search supplier records." };
    }
    const searchTerm = extractEntitySearchTerm(question, "supplier");
    if (!searchTerm) return { tool: "search_suppliers", data: { message: "Enter a supplier name to search.", suppliers: [] } };
    const serviceClient = (await import("../supabase/server")).createSupabaseServiceClient();
    const { data, error } = await serviceClient
      .from("suppliers")
      .select("company_name,status")
      .ilike("company_name", `%${searchTerm}%`)
      .order("company_name")
      .limit(10);
    if (error) throw error;
    return { tool: "search_suppliers", data: data ?? [] };
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
    if (/\b(low stock|out of stock|reorder|restock|inventory alert)\b/i.test(question)) {
      if (!context || !requires(context, "inventory.read")) {
        return { tool: "authorization", data: "You are not authorized to review low-stock inventory alerts." };
      }
      const serviceClient = (await import("../supabase/server")).createSupabaseServiceClient();
      const { data: alerts, error: alertsError } = await serviceClient
        .from("inventory_health")
        .select("product_id,available_quantity,reorder_level")
        .eq("is_low_stock", true)
        .order("available_quantity", { ascending: true })
        .limit(50);
      if (alertsError) throw alertsError;
      const productIds = [...new Set((alerts ?? []).map((row) => row.product_id))];
      const { data: products, error: productsError } = productIds.length
        ? await serviceClient.from("products").select("id,name,sku").in("id", productIds)
        : { data: [], error: null };
      if (productsError) throw productsError;
      const productById = new Map((products ?? []).map((product) => [product.id, product]));
      const grouped = new Map<string, { name: string; sku: string; flaggedLocations: number; availableAtFlaggedLocations: number; combinedReorderThreshold: number }>();
      for (const alert of alerts ?? []) {
        const product = productById.get(alert.product_id);
        if (!product) continue;
        const current = grouped.get(alert.product_id) ?? {
          name: product.name,
          sku: product.sku,
          flaggedLocations: 0,
          availableAtFlaggedLocations: 0,
          combinedReorderThreshold: 0,
        };
        current.flaggedLocations += 1;
        current.availableAtFlaggedLocations += Number(alert.available_quantity);
        current.combinedReorderThreshold += Number(alert.reorder_level);
        grouped.set(alert.product_id, current);
      }
      return {
        tool: "get_inventory_alerts",
        data: {
          alerts: [...grouped.values()],
          truncated: (alerts ?? []).length === 50,
          locationScope: "Quantities and reorder thresholds are combined only across locations currently below their reorder level.",
        },
      };
    }
    const products = await getCatalogProducts(client, { search: question, allowFallback: false });
    const productIds = products.slice(0, 8).map((product) => product.id);
    const serviceClient = (await import("../supabase/server")).createSupabaseServiceClient();
    const { data, error } = productIds.length
      ? await serviceClient.from("inventory").select("product_id, quantity, reserved_quantity").in("product_id", productIds)
      : { data: [], error: null };
    if (error) throw error;
    return { tool: "getProductAvailability", data: products.slice(0, 8).map((product) => ({ name: product.name, sku: product.sku, available: (data ?? []).filter((row) => row.product_id === product.id).reduce((total, row) => total + Math.max(0, Number(row.quantity ?? 0) - Number(row.reserved_quantity ?? 0)), 0) })) };
  }

  if (intent === "payments") {
    if (!context) return { tool: "authorization", data: "Sign in to check payment records." };
    const serviceClient = (await import("../supabase/server")).createSupabaseServiceClient();
    if (/\b(cash session|cash drawer)\b/i.test(question)) {
      if (!requires(context, "orders.read") && !requires(context, "orders.create")) {
        return { tool: "authorization", data: "You are not authorized to read POS cash-session information." };
      }
      const { data: sessions, error: sessionsError } = await serviceClient
        .from("pos_sessions")
        .select("id,status,opening_balance,closing_balance,opened_at,closed_at")
        .eq("employee_id", context.userId)
        .order("opened_at", { ascending: false })
        .limit(10);
      if (sessionsError) throw sessionsError;
      const activeSession = sessions?.find((session) => session.status === "OPEN");
      const session = activeSession ?? sessions?.[0];
      if (!session) return { tool: "get_cash_session", data: { status: "not_opened" } };
      const multipleOpenSessions = (sessions ?? []).filter((item) => item.status === "OPEN").length > 1;

      const { data: movements, error: movementsError } = await serviceClient
        .from("cash_movements")
        .select("movement_type,amount")
        .eq("session_id", session.id);
      if (movementsError) throw movementsError;
      const ledger = (movements ?? []).reduce((total, movement) => {
        switch (movement.movement_type) {
          case "SALE":
          case "PAID_IN":
            return total + Number(movement.amount);
          case "REFUND":
          case "PAID_OUT":
            return total - Number(movement.amount);
          default:
            return total;
        }
      }, Number(session.opening_balance));
      return {
        tool: "get_cash_session",
        data: {
          status: session.status.toLowerCase(),
          openedAt: session.opened_at,
          closedAt: session.closed_at,
          openingFloat: Number(session.opening_balance),
          expectedCash: Number(ledger.toFixed(2)),
          countedCash: session.closing_balance === null ? null : Number(session.closing_balance),
          variance: session.closing_balance === null ? null : Number((Number(session.closing_balance) - ledger).toFixed(2)),
          multipleOpenSessions,
          verifiedCashSales: (movements ?? [])
            .filter((movement) => movement.movement_type === "SALE")
            .reduce((sum, movement) => sum + Number(movement.amount), 0)
        }
      };
    }

    if (surface === "storefront") {
      const { data: customer, error: customerError } = await client
        .from("customers")
        .select("id")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (customerError) throw customerError;
      if (!customer) return { tool: "get_my_payments", data: [] };
      const { data: orders, error: ordersError } = await client
        .from("orders")
        .select("id,order_number")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (ordersError) throw ordersError;
      const orderIds = (orders ?? []).map((order) => order.id);
      if (!orderIds.length) return { tool: "get_my_payments", data: [] };
      const { data: payments, error: paymentsError } = await serviceClient
        .from("payments")
        .select("order_id,method,status,amount,currency,created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false })
        .limit(20);
      if (paymentsError) throw paymentsError;
      const orderNumbers = new Map((orders ?? []).map((order) => [order.id, order.order_number]));
      return {
        tool: "get_my_payments",
        data: (payments ?? []).map((payment) => ({
          orderNumber: orderNumbers.get(payment.order_id) ?? "Order",
          method: payment.method,
          status: payment.status,
          amount: Number(payment.amount),
          currency: payment.currency,
          createdAt: payment.created_at
        }))
      };
    }
    if (!requires(context, "payments.read") && !requires(context, "reports.read") && !requires(context, "finance.read")) {
      return { tool: "authorization", data: "You are not authorized to access business payment summaries." };
    }
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return {
      tool: "get_payment_summary",
      data: {
        period: "Last 7 days",
        ...await getVerifiedPaymentSummary(serviceClient, since)
      }
    };
  }

  if (!context) return { tool: "authorization", data: "Sign in to access private order information." };

  if (intent === "orders") {
    if (surface !== "storefront" && !isSurfaceAllowed(surface, context)) {
      return { tool: "authorization", data: "You do not have access to that surface." };
    }
    if (surface !== "storefront") {
      if (!requires(context, "orders.read")) {
        return { tool: "authorization", data: "You are not authorized to access business orders." };
      }
      const serviceClient = (await import("../supabase/server")).createSupabaseServiceClient();
      const orderNumber = question.match(/\bDT-[A-Z0-9-]{4,}\b/i)?.[0];
      const unpaidOnly = /\b(unpaid|payment pending|awaiting payment)\b/i.test(question);
      let query = serviceClient
        .from("orders")
        .select("id,order_number,total,payment_status,order_status,sales_channel,created_at");
      if (unpaidOnly) query = query.in("payment_status", ["PENDING", "PROCESSING"]);
      query = orderNumber
        ? query.eq("order_number", orderNumber)
        : query.order("created_at", { ascending: false }).limit(10);
      const { data: orders, error } = await query;
      if (error) throw error;
      if (orderNumber && orders?.length === 1) {
        const order = orders[0];
        const { data: items, error: itemsError } = await serviceClient
          .from("order_items")
          .select("product_name_snapshot,sku_snapshot,quantity,line_total")
          .eq("order_id", order.id)
          .limit(50);
        if (itemsError) throw itemsError;
        return {
          tool: "get_order",
          data: {
            orderNumber: order.order_number,
            total: Number(order.total),
            paymentStatus: order.payment_status,
            orderStatus: order.order_status,
            salesChannel: order.sales_channel,
            createdAt: order.created_at,
            items: (items ?? []).map((item) => ({
              name: item.product_name_snapshot,
              sku: item.sku_snapshot,
              quantity: item.quantity,
              lineTotal: Number(item.line_total),
            })),
          },
        };
      }
      return {
        tool: "search_orders",
        data: orderNumber
          ? []
          : (orders ?? []).map((order) => ({
            orderNumber: order.order_number,
            total: Number(order.total),
            paymentStatus: order.payment_status,
            orderStatus: order.order_status,
            salesChannel: order.sales_channel,
            createdAt: order.created_at,
          })),
      };
    }
    const { data: customer, error: customerError } = await client
      .from("customers")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return { tool: "getMyOrders", data: [] };
    const { data, error } = await getCustomerOrders(client, customer.id);
    if (error) throw error;
    return { tool: "getMyOrders", data: (data ?? []).map((order) => ({ orderNumber: order.order_number, status: order.order_status, paymentStatus: order.payment_status, total: order.total, createdAt: order.created_at })) };
  }

  if (intent === "sales") {
    if (!requires(context, "reports.read")) return { tool: "authorization", data: "You are not authorized to access that business information." };
    const serviceClient = (await import("../supabase/server")).createSupabaseServiceClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: orders, count, error }, paymentSummary] = await Promise.all([
      serviceClient
        .from("orders")
        .select("id,sales_channel", { count: "exact" })
        .eq("payment_status", "SUCCESS")
        .gte("created_at", since)
        .limit(100),
      getVerifiedPaymentSummary(serviceClient, since),
    ]);
    if (error) throw error;
    return {
      tool: "generate_report",
      data: {
        period: "Last 7 days",
        successfulOrderCount: count ?? 0,
        ordersReviewed: orders?.length ?? 0,
        orderListTruncated: (orders?.length ?? 0) === 100,
        successfulOrdersByChannel: {
          online: (orders ?? []).filter((order) => order.sales_channel === "ONLINE").length,
          pos: (orders ?? []).filter((order) => order.sales_channel === "POS").length,
        },
        ...paymentSummary,
      },
    };
  }

  if (intent === "quotes") {
    if (surface !== "storefront") {
      if (!requires(context, "quotes.read")) {
        return { tool: "authorization", data: "You are not authorized to access business quotations." };
      }
      const serviceClient = (await import("../supabase/server")).createSupabaseServiceClient();
      const quoteNumber = extractQuoteNumber(question);
      let query = serviceClient
        .from("quotations")
        .select("id,quote_number,status,total,valid_until,created_at,converted_order_id");
      query = quoteNumber
        ? query.eq("quote_number", quoteNumber).limit(1)
        : query.order("created_at", { ascending: false }).limit(10);
      if (/\b(pending|awaiting|not approved)\b/i.test(question)) {
        query = query.in("status", ["DRAFT", "SENT", "VIEWED"]);
      }
      const { data, error } = await query;
      if (error) throw error;
      const quote = quoteNumber && data?.length === 1 ? data[0] : null;
      const { data: items, error: itemsError } = quote
        ? await serviceClient
          .from("quotation_items")
          .select("product_name_snapshot,sku_snapshot,quantity,line_total")
          .eq("quotation_id", quote.id)
          .limit(50)
        : { data: [], error: null };
      if (itemsError) throw itemsError;
      return {
        tool: quoteNumber ? "get_quote" : "search_quotes",
        data: quote
          ? {
            quoteNumber: quote.quote_number,
            status: quote.status,
            total: Number(quote.total),
            validUntil: quote.valid_until,
            createdAt: quote.created_at,
            convertedToOrder: Boolean(quote.converted_order_id),
            items: (items ?? []).map((item) => ({
              name: item.product_name_snapshot,
              sku: item.sku_snapshot,
              quantity: item.quantity,
              lineTotal: Number(item.line_total),
            })),
          }
          : (data ?? []).map((entry) => ({
            quoteNumber: entry.quote_number,
            status: entry.status,
            total: Number(entry.total),
            validUntil: entry.valid_until,
            createdAt: entry.created_at,
            convertedToOrder: Boolean(entry.converted_order_id),
          })),
      };
    }
    const { data: customer, error: customerError } = await client
      .from("customers")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return { tool: "getMyQuotationStatus", data: [] };
    const { data, error } = await getCustomerQuotes(client, customer.id);
    if (error) throw error;
    return { tool: "getMyQuotationStatus", data: (data ?? []).map((quote) => ({ quoteNumber: quote.quote_number, status: quote.status, total: quote.total })) };
  }

  if (surface === "centre" || surface === "admin") {
    return { tool: "getBusinessSummary", data: await getSurfaceBusinessSummary(surface, context.permissions) };
  }

  return { tool: "authorization", data: "That information is not available for this account." };
}
