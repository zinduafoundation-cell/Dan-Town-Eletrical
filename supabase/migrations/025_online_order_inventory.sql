-- Keep online and POS transactions distinguishable while sharing inventory.
alter table public.orders
  add column if not exists sales_channel text not null default 'ONLINE'
  check (sales_channel in ('ONLINE', 'POS'));

create index if not exists orders_sales_channel_created_idx on public.orders(sales_channel, created_at desc);

-- Create an online order and reserve stock in one transaction.
create or replace function public.create_online_order(
  order_number text,
  buyer_user_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  fulfillment_type text,
  shipping_details jsonb,
  delivery_fee numeric,
  requested_items jsonb
)
returns public.orders
language plpgsql
set search_path = public
as $$
declare
  new_order public.orders;
  customer_record public.customers;
  item jsonb;
  product_record public.products;
  inventory_record public.inventory;
  requested_quantity integer;
  calculated_subtotal numeric := 0;
  calculated_vat numeric := 0;
begin
  if jsonb_array_length(requested_items) = 0 then
    raise exception 'An order must contain at least one item';
  end if;
  if fulfillment_type not in ('pickup', 'delivery') then
    raise exception 'Invalid fulfillment type';
  end if;
  if delivery_fee < 0 then
    raise exception 'Delivery fee cannot be negative';
  end if;

  for item in select * from jsonb_array_elements(requested_items)
  loop
    requested_quantity := (item->>'quantity')::integer;
    if requested_quantity < 1 then raise exception 'Quantity must be positive'; end if;
    select * into product_record from public.products where id = (item->>'product_id')::uuid and is_active = true and status = 'ACTIVE';
    if not found then raise exception 'A selected product is unavailable'; end if;
    select * into inventory_record from public.inventory where product_id = product_record.id order by quantity desc limit 1 for update;
    if not found or inventory_record.quantity - inventory_record.reserved_quantity < requested_quantity then
      raise exception 'Insufficient stock for %', product_record.name;
    end if;
    calculated_subtotal := calculated_subtotal + product_record.retail_price * requested_quantity;
    calculated_vat := calculated_vat + round(product_record.retail_price * requested_quantity * product_record.vat_rate / 100, 2);
  end loop;

  select * into customer_record from public.customers where phone = customer_phone and status = 'ACTIVE' limit 1;
  if not found then
    insert into public.customers (user_id, name, phone, email, customer_type, status)
      values (buyer_user_id, customer_name, customer_phone, nullif(customer_email, ''), 'RETAIL', 'ACTIVE')
      returning * into customer_record;
  else
    update public.customers set user_id = coalesce(customer_record.user_id, buyer_user_id), email = coalesce(nullif(customer_email, ''), customer_record.email), updated_at = timezone('utc', now()) where id = customer_record.id
      returning * into customer_record;
  end if;

  insert into public.orders (
    order_number, customer_id, subtotal, discount, vat, delivery_fee, total,
    payment_status, order_status, created_by, sales_channel, shipping_address, notes
  ) values (
    order_number, customer_record.id, calculated_subtotal, 0, calculated_vat, delivery_fee,
    calculated_subtotal + calculated_vat + delivery_fee, 'PENDING', 'PENDING', buyer_user_id, 'ONLINE',
    shipping_details, 'Fulfillment: ' || fulfillment_type
  ) returning * into new_order;

  for item in select * from jsonb_array_elements(requested_items)
  loop
    select * into product_record from public.products where id = (item->>'product_id')::uuid;
    insert into public.order_items (order_id, product_id, variant_id, product_name_snapshot, sku_snapshot, unit_price, quantity, discount, vat, line_total)
      values (new_order.id, product_record.id, null, product_record.name, product_record.sku, product_record.retail_price, (item->>'quantity')::integer, 0, round(product_record.retail_price * (item->>'quantity')::integer * product_record.vat_rate / 100, 2), product_record.retail_price * (item->>'quantity')::integer);
    update public.inventory set reserved_quantity = reserved_quantity + (item->>'quantity')::integer where id = (select i.id from public.inventory i where i.product_id = product_record.id order by i.quantity desc limit 1);
  end loop;

  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data)
    values (buyer_user_id, 'ONLINE_ORDER_CREATED', 'order', new_order.id, jsonb_build_object('order_number', new_order.order_number, 'sales_channel', 'ONLINE', 'reserved_items', requested_items));
  return new_order;
end;
$$;

revoke all on function public.create_online_order(text, uuid, text, text, text, text, jsonb, numeric, jsonb) from public;
grant execute on function public.create_online_order(text, uuid, text, text, text, text, jsonb, numeric, jsonb) to service_role;
