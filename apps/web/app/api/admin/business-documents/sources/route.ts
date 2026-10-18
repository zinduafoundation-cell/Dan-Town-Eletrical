import { NextResponse } from "next/server";
import { z } from "zod";
import { getPermissionGuard } from "@/lib/auth/server";
import { getBusinessDocumentSourceKind } from "@/lib/documents/business-document-types";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SourceLine = { name: string; sku: string | null; quantity: number; unitPrice: number };

const sourceSearchTypes = [
  "SALES_ORDER", "INVOICE", "CREDIT_NOTE", "DEBIT_NOTE", "SALES_RETURN_FORM",
  "DELIVERY_NOTE", "DISPATCH_NOTE", "PURCHASE_ORDER", "SUPPLIER_INVOICE",
  "GOODS_RECEIVED_NOTE", "PURCHASE_RETURN_FORM",
] as const;

const querySchema = z.object({
  type: z.enum(sourceSearchTypes),
  q: z.string().trim().min(2).max(80),
});

export async function GET(request: Request) {
  try {
    const guard = await getPermissionGuard("settings.manage");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
    const params = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse({
      type: params.get("type") ?? "",
      q: params.get("q") ?? "",
    });
    if (!parsed.success) return NextResponse.json({ error: "Enter at least two characters and choose a supported document type." }, { status: 400 });

    const sourceKind = getBusinessDocumentSourceKind(parsed.data.type);
    if (!sourceKind) return NextResponse.json({ error: "This document type has no linked source search." }, { status: 400 });
    const supabase = createSupabaseServiceClient();
    const searchText = parsed.data.q.replace(/[,%_]/g, "").trim();
    if (searchText.length < 2) {
      return NextResponse.json({ error: "Enter at least two letters or numbers from the source reference." }, { status: 400 });
    }
    const pattern = `%${searchText}%`;

    if (sourceKind === "order") {
      const { data, error } = await supabase.from("orders")
        .select("id,order_number,customer_id,subtotal,discount,vat,delivery_fee,total,payment_status,order_status,created_at")
        .ilike("order_number", pattern)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      const orderIds = (data ?? []).map((row) => row.id);
      const customerIds = [...new Set((data ?? []).map((row) => row.customer_id).filter((id): id is string => id !== null))];
      const [{ data: items, error: itemsError }, { data: customers, error: customersError }] = await Promise.all([
        orderIds.length
          ? supabase.from("order_items")          .select("order_id,product_name_snapshot,sku_snapshot,quantity,unit_price,line_total").in("order_id", orderIds)
          : Promise.resolve({ data: [], error: null }),
        customerIds.length
          ? supabase.from("customers").select("id,name,phone,tax_number").in("id", customerIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (itemsError) throw itemsError;
      if (customersError) throw customersError;
      const itemsByOrder = new Map<string, SourceLine[]>();
      for (const item of items ?? []) {
        const lines = itemsByOrder.get(item.order_id) ?? [];
        lines.push({
          name: item.product_name_snapshot,
          sku: item.sku_snapshot || null,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
        });
        itemsByOrder.set(item.order_id, lines);
      }
      const customersById = new Map((customers ?? []).map((customer) => [customer.id, customer]));
      return NextResponse.json({
        data: (data ?? []).map((row) => {
          const customer = row.customer_id ? customersById.get(row.customer_id) : undefined;
          return {
            id: row.id,
            reference: row.order_number,
            status: `${row.payment_status} · ${row.order_status}`,
            total: Number(row.total),
            createdAt: row.created_at,
            partyName: customer?.name ?? null,
            partyContact: customer?.phone ?? null,
            taxPin: customer?.tax_number ?? null,
            subtotal: Number(row.subtotal),
            discount: Number(row.discount),
            tax: Number(row.vat),
            lines: [
              ...(itemsByOrder.get(row.id) ?? []),
              ...(Number(row.delivery_fee) > 0
                ? [{ name: "Delivery", sku: null, quantity: 1, unitPrice: Number(row.delivery_fee) }]
                : []),
            ],
          };
        }),
      });
    }

    const { data, error } = await supabase.from("purchase_orders")
      .select("id,order_number,supplier_id,subtotal,tax,total,status,created_at")
      .ilike("order_number", pattern)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    const purchaseOrderIds = (data ?? []).map((row) => row.id);
    const supplierIds = [...new Set((data ?? []).map((row) => row.supplier_id))];
    const [{ data: items, error: itemsError }, { data: suppliers, error: suppliersError }] = await Promise.all([
      purchaseOrderIds.length
        ? supabase.from("purchase_order_items").select("purchase_order_id,product_id,quantity,unit_cost").in("purchase_order_id", purchaseOrderIds)
        : Promise.resolve({ data: [], error: null }),
      supplierIds.length
        ? supabase.from("suppliers").select("id,company_name,phone,tax_number,payment_terms").in("id", supplierIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (itemsError) throw itemsError;
    if (suppliersError) throw suppliersError;
    const productIds = [...new Set((items ?? []).map((item) => item.product_id))];
    const { data: products, error: productsError } = productIds.length
      ? await supabase.from("products").select("id,name,sku").in("id", productIds)
      : { data: [], error: null };
    if (productsError) throw productsError;
    const productsById = new Map((products ?? []).map((product) => [product.id, product]));
    const suppliersById = new Map((suppliers ?? []).map((supplier) => [supplier.id, supplier]));
    const itemsByPurchaseOrder = new Map<string, SourceLine[]>();
    for (const item of items ?? []) {
      const product = productsById.get(item.product_id);
      const lines = itemsByPurchaseOrder.get(item.purchase_order_id) ?? [];
      lines.push({
        name: product?.name ?? "Product no longer in catalogue",
        sku: product?.sku ?? null,
        quantity: item.quantity,
        unitPrice: Number(item.unit_cost),
      });
      itemsByPurchaseOrder.set(item.purchase_order_id, lines);
    }
    return NextResponse.json({
      data: (data ?? []).map((row) => {
        const supplier = suppliersById.get(row.supplier_id);
        return {
          id: row.id,
          reference: row.order_number,
          status: row.status,
          total: Number(row.total),
          createdAt: row.created_at,
          partyName: supplier?.company_name ?? null,
          partyContact: supplier?.phone ?? null,
          taxPin: supplier?.tax_number ?? null,
          paymentTerms: supplier?.payment_terms ?? null,
          subtotal: Number(row.subtotal),
          discount: 0,
          tax: Number(row.tax),
          lines: itemsByPurchaseOrder.get(row.id) ?? [],
        };
      }),
    });
  } catch (error) {
    console.error("Unable to search business document source records:", error);
    return NextResponse.json({ error: "Source records could not be searched." }, { status: 500 });
  }
}
