import { OnlineOrdersWorkspace, type OnlineOrder } from "@/components/admin/online-orders-workspace";
import { PortalShell } from "@/app/portal-shell";
import { requireAuthorizedPermission } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const context = await requireAuthorizedPermission("orders.read");
  const supabase = createSupabaseServiceClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id,order_number,customer_id,subtotal,vat,delivery_fee,total,payment_status,order_status,sales_channel,shipping_address,notes,delivery_method,delivery_carrier,delivery_tracking_reference,delivered_at,delivery_proof_path,delivery_confirmed_at,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const orderRows = orders ?? [];
  const customerIds = [...new Set(orderRows.map((order) => order.customer_id).filter((id): id is string => Boolean(id)))];
  const orderIds = orderRows.map((order) => order.id);
  const [{ data: customers, error: customersError }, { data: items, error: itemsError }] = await Promise.all([
    customerIds.length
      ? supabase.from("customers").select("id,name,phone,email").in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabase.from("order_items").select("id,order_id,product_name_snapshot,sku_snapshot,quantity,unit_price,line_total").in("order_id", orderIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (customersError) throw customersError;
  if (itemsError) throw itemsError;

  const customerMap = new Map((customers ?? []).map((customer) => [customer.id, customer]));
  const itemsByOrder = new Map<string, NonNullable<typeof items>>();
  for (const item of items ?? []) {
    itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);
  }

  const proofPaths = [...new Set(orderRows.map((order) => order.delivery_proof_path).filter((path): path is string => Boolean(path)))];
  const proofUrls = new Map<string, string>();
  if (proofPaths.length) {
    const { data, error: signedUrlsError } = await supabase.storage
      .from("delivery-proofs")
      .createSignedUrls(proofPaths, 300);
    if (signedUrlsError) throw signedUrlsError;
    for (const entry of data ?? []) {
      if (entry.error) throw new Error(`Unable to create signed delivery proof URL: ${entry.error}`);
      if (entry.path && entry.signedUrl) proofUrls.set(entry.path, entry.signedUrl);
    }
  }

  const viewRows: OnlineOrder[] = orderRows.map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      salesChannel: order.sales_channel,
      customer: customerMap.get(order.customer_id ?? "") ?? null,
      subtotal: Number(order.subtotal),
      vat: Number(order.vat),
      deliveryFee: Number(order.delivery_fee),
      total: Number(order.total),
      paymentStatus: order.payment_status,
      orderStatus: order.order_status,
      shippingAddress: order.shipping_address as OnlineOrder["shippingAddress"],
      fulfillmentType: String(order.notes ?? "").toLowerCase().includes("pickup") ? "pickup" : "delivery",
      deliveryMethod: order.delivery_method,
      deliveryCarrier: order.delivery_carrier,
      deliveryTrackingReference: order.delivery_tracking_reference,
      deliveredAt: order.delivered_at,
      deliveryConfirmedAt: order.delivery_confirmed_at,
      deliveryProofUrl: order.delivery_proof_path ? proofUrls.get(order.delivery_proof_path) ?? null : null,
      createdAt: order.created_at,
      items: (itemsByOrder.get(order.id) ?? []).map((item) => ({
        id: item.id,
        name: item.product_name_snapshot,
        sku: item.sku_snapshot,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        lineTotal: Number(item.line_total)
      }))
    }));

  return (
    <PortalShell
      title="Orders."
      description="Track fulfillment, transport, and customer delivery confirmation across website and POS orders."
      roles={context.roles}
      permissions={context.permissions}
      links={[
        { label: "Overview", href: "/admin" },
        { label: "Orders", href: "/admin/orders", permission: "orders.read" },
        { label: "POS", href: "/pos", permission: "orders.read" },
        { label: "Customers", href: "/admin/customers", permission: "customers.read" },
        { label: "Inventory", href: "/admin/inventory", permission: "inventory.read" },
        { label: "Payments", href: "/admin/payments", permission: "payments.read" }
      ]}
    >
      <OnlineOrdersWorkspace orders={viewRows} isAdmin={context.permissions.includes("orders.update")} />
    </PortalShell>
  );
}
