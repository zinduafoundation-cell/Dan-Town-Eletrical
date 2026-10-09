import { requireAuthenticated } from "../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { PortalShell } from "../../portal-shell";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AccountOrdersPage() {
  const context = await requireAuthenticated();
  const supabase = await createSupabaseServerClient();
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (customerError) {
    throw new Error(`Unable to load your customer record from Supabase: ${customerError.message}`);
  }

  const ordersResult = customer
    ? await supabase
        .from("orders")
        .select("id, order_number, total, order_status, payment_status, created_at")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (ordersResult.error) {
    throw new Error(`Unable to load your orders from Supabase: ${ordersResult.error.message}`);
  }
  const orders = ordersResult.data ?? [];

  return (
    <PortalShell
      title="Your orders."
      description="Track purchases and payment status."
      roles={context.roles}
      permissions={context.permissions}
      links={[
        { label: "Overview", href: "/account" },
        { label: "Orders", href: "/account/orders" },
        { label: "Quotes", href: "/account/quotes" },
        { label: "Wishlist", href: "/account/wishlist" },
      ]}
    >
      <div className="content-panel">
        {orders.length ? (
          orders.map((order) => (
            <article className="portal-list-row" key={order.id}>
              <div>
                <strong>{order.order_number}</strong>
                <small>{new Date(order.created_at).toLocaleDateString()}</small>
              </div>
              <div>
                <strong>KSh {Number(order.total).toLocaleString()}</strong>
                <small>
                  {order.order_status} · {order.payment_status}
                </small>
              </div>
              <Link className="text-link" href={`/account/orders/${order.id}`}>View details <ArrowRight size={14} /></Link>
            </article>
          ))
        ) : (
          <p>No orders yet.</p>
        )}
      </div>
    </PortalShell>
  );
}
