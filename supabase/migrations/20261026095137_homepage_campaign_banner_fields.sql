alter table public.storefront_promotions
  add column if not exists mobile_image_url text,
  add column if not exists cta_label text not null default 'Shop now',
  add column if not exists show_on_homepage boolean not null default false;

alter table public.storefront_promotions
  add constraint storefront_promotions_cta_label_check
  check (length(btrim(cta_label)) between 1 and 48);

create index if not exists storefront_promotions_homepage_idx
  on public.storefront_promotions (sort_order, starts_at, ends_at)
  where is_active and show_on_homepage;

create or replace function public.get_storefront_best_sellers(p_limit integer default 8)
returns table (product_id uuid, units_sold bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select items.product_id, sum(items.quantity)::bigint as units_sold
  from public.order_items as items
  join public.orders as orders on orders.id = items.order_id
  join public.products as products on products.id = items.product_id
  where items.product_id is not null
    and products.is_active
    and products.status = 'ACTIVE'
    and orders.payment_status = 'SUCCESS'
    and orders.order_status not in ('CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED')
  group by items.product_id
  order by units_sold desc, items.product_id
  limit least(greatest(coalesce(p_limit, 8), 1), 24);
$$;

revoke all on function public.get_storefront_best_sellers(integer) from public, anon, authenticated;
grant execute on function public.get_storefront_best_sellers(integer) to service_role;