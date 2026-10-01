-- One bounded read model for the Centre dashboard. It moves aggregation to
-- Postgres so the application no longer transfers every row from today's
-- orders, payments, inventory, and POS-sync tables merely to show counters.
create or replace function public.get_business_centre_metrics()
returns table (
  revenue_today numeric,
  pos_sales_today numeric,
  online_sales_today numeric,
  orders_today bigint,
  pending_orders bigint,
  pending_payments bigint,
  low_stock_lines bigint,
  out_of_stock_lines bigint,
  product_count bigint,
  customer_count bigint,
  active_pos_sessions bigint,
  pos_transactions bigint,
  pending_sync bigint,
  failed_sync bigint,
  conflict_sync bigint,
  pending_domain_events bigint,
  retry_domain_events bigint,
  processing_domain_events bigint,
  dead_letter_domain_events bigint
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with bounds as (
    select
      date_trunc('day', timezone('Africa/Nairobi', now())) at time zone 'Africa/Nairobi' as day_start,
      (date_trunc('day', timezone('Africa/Nairobi', now())) + interval '1 day') at time zone 'Africa/Nairobi' as day_end
  )
  select
    coalesce((select sum(o.total) from public.orders o, bounds b where o.payment_status = 'SUCCESS' and o.created_at >= b.day_start and o.created_at < b.day_end), 0)::numeric,
    coalesce((select sum(o.total) from public.orders o, bounds b where o.payment_status = 'SUCCESS' and o.sales_channel = 'POS' and o.created_at >= b.day_start and o.created_at < b.day_end), 0)::numeric,
    coalesce((select sum(o.total) from public.orders o, bounds b where o.payment_status = 'SUCCESS' and o.sales_channel = 'ONLINE' and o.created_at >= b.day_start and o.created_at < b.day_end), 0)::numeric,
    (select count(*) from public.orders o, bounds b where o.created_at >= b.day_start and o.created_at < b.day_end),
    (select count(*) from public.orders o, bounds b where o.order_status in ('PENDING', 'PAYMENT_PENDING', 'PROCESSING') and o.created_at >= b.day_start and o.created_at < b.day_end),
    (select count(*) from public.orders o, bounds b where o.payment_status in ('PENDING', 'PROCESSING') and o.created_at >= b.day_start and o.created_at < b.day_end),
    (select count(*) from public.inventory i where i.quantity - i.reserved_quantity <= i.reorder_level),
    (select count(*) from public.inventory i where i.quantity - i.reserved_quantity <= 0),
    (select count(*) from public.products),
    (select count(*) from public.customers),
    (select count(*) from public.pos_sessions where status = 'OPEN'),
    (select count(*) from public.orders o, bounds b where o.payment_status = 'SUCCESS' and o.sales_channel = 'POS' and o.created_at >= b.day_start and o.created_at < b.day_end),
    (select count(*) from public.pos_sync_records where status in ('PENDING', 'SYNCING')),
    (select count(*) from public.pos_sync_records where status = 'FAILED'),
    (select count(*) from public.pos_sync_records where status = 'CONFLICT'),
    (select count(*) from public.domain_events where status = 'PENDING'),
    (select count(*) from public.domain_events where status = 'RETRY'),
    (select count(*) from public.domain_events where status = 'PROCESSING'),
    (select count(*) from public.domain_events where status = 'DEAD_LETTER');
$$;

revoke all on function public.get_business_centre_metrics() from public;
grant execute on function public.get_business_centre_metrics() to service_role;

notify pgrst, 'reload schema';
