create or replace view public.inventory_health with (security_invoker = true) as
select i.id, i.product_id, i.warehouse_id, i.quantity, i.reserved_quantity,
       i.quantity - i.reserved_quantity as available_quantity,
       i.reorder_level, i.reorder_quantity,
       (i.quantity - i.reserved_quantity) <= i.reorder_level as is_low_stock
from public.inventory i;

create index if not exists products_barcode_idx on public.products(barcode);
create index if not exists products_sku_lower_idx on public.products(lower(sku::text));
create index if not exists order_history_order_created_idx on public.order_status_history(order_id, created_at);

