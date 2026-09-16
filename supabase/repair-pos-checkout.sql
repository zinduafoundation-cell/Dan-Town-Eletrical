-- Run this once in Supabase Dashboard > SQL Editor if migration 024 was skipped.
-- It restores the RPC used by POST /api/pos/checkout.

alter table public.orders
  add column if not exists processed_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists processed_by_staff_name text,
  add column if not exists processed_by_staff_role text;

create index if not exists orders_processed_by_user_idx on public.orders(processed_by_user_id);
create index if not exists orders_order_number_idx on public.orders(order_number);

create or replace function public.complete_pos_sale(
  sale_order_number text,
  sale_customer_id uuid,
  sale_subtotal numeric,
  sale_vat numeric,
  sale_total numeric,
  sale_payment_method public.payment_method,
  sale_staff_user_id uuid,
  sale_staff_name text,
  sale_staff_role text,
  sale_items jsonb
)
returns public.orders
language plpgsql
set search_path = public
as $$
declare
  new_order public.orders;
  item jsonb;
  inventory_row public.inventory;
  requested_quantity integer;
  product_row public.products;
begin
  if jsonb_array_length(sale_items) = 0 then
    raise exception 'A sale must contain at least one item';
  end if;

  for item in select * from jsonb_array_elements(sale_items)
  loop
    requested_quantity := (item->>'quantity')::integer;
    if requested_quantity < 1 then
      raise exception 'Quantity must be positive';
    end if;

    select * into product_row from public.products
      where id = (item->>'product_id')::uuid and is_active = true;
    if not found then
      raise exception 'Product is unavailable';
    end if;

    select * into inventory_row from public.inventory
      where product_id = product_row.id
      order by quantity desc
      limit 1
      for update;
    if not found or inventory_row.quantity - inventory_row.reserved_quantity < requested_quantity then
      raise exception 'Insufficient stock for %', product_row.name;
    end if;
  end loop;

  insert into public.orders (
    order_number, customer_id, subtotal, discount, vat, delivery_fee, total,
    payment_status, order_status, created_by, processed_by_user_id,
    processed_by_staff_name, processed_by_staff_role
  ) values (
    sale_order_number, sale_customer_id, sale_subtotal, 0, sale_vat, 0, sale_total,
    'SUCCESS', 'PAID', sale_staff_user_id, sale_staff_user_id,
    sale_staff_name, sale_staff_role
  ) returning * into new_order;

  for item in select * from jsonb_array_elements(sale_items)
  loop
    select * into product_row from public.products where id = (item->>'product_id')::uuid;
    insert into public.order_items (
      order_id, product_id, variant_id, product_name_snapshot, sku_snapshot,
      unit_price, quantity, discount, vat, line_total
    ) values (
      new_order.id, product_row.id, null, product_row.name, product_row.sku,
      product_row.retail_price, (item->>'quantity')::integer, 0,
      round(product_row.retail_price * (item->>'quantity')::integer * product_row.vat_rate / 100, 2),
      product_row.retail_price * (item->>'quantity')::integer
    );

    update public.inventory
      set quantity = quantity - (item->>'quantity')::integer
      where id = (select i.id from public.inventory i where i.product_id = product_row.id order by i.quantity desc limit 1);
  end loop;

  insert into public.payments (order_id, method, status, amount, currency, provider)
    values (new_order.id, sale_payment_method, 'SUCCESS', sale_total, 'KES', 'DANTOWN_POS');

  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data)
    values (sale_staff_user_id, 'SALE_COMPLETED', 'order', new_order.id,
      jsonb_build_object('order_number', new_order.order_number, 'staff_name', sale_staff_name, 'staff_role', sale_staff_role, 'total', sale_total));

  return new_order;
end;
$$;

revoke all on function public.complete_pos_sale(text, uuid, numeric, numeric, numeric, public.payment_method, uuid, text, text, jsonb) from public;
grant execute on function public.complete_pos_sale(text, uuid, numeric, numeric, numeric, public.payment_method, uuid, text, text, jsonb) to service_role;

notify pgrst, 'reload schema';

-- Optional split-tender support. Run this block after the main repair if using split payments.
create or replace function public.complete_pos_sale_split(
  sale_order_number text, sale_customer_id uuid, sale_subtotal numeric, sale_vat numeric,
  sale_total numeric, sale_payment_method public.payment_method, sale_staff_user_id uuid,
  sale_staff_name text, sale_staff_role text, sale_items jsonb, sale_split_payments jsonb
)
returns public.orders language plpgsql set search_path = public as $$
declare
  new_order public.orders;
  first_payment_id uuid;
  split_total numeric := 0;
  payment jsonb;
begin
  if jsonb_array_length(sale_split_payments) <> 2 then raise exception 'Split sale requires exactly two payments'; end if;
  for payment in select * from jsonb_array_elements(sale_split_payments) loop split_total := split_total + (payment->>'amount')::numeric; end loop;
  if round(split_total, 2) <> round(sale_total, 2) then raise exception 'Split payments must equal sale total'; end if;
  select * into new_order from public.complete_pos_sale(sale_order_number, sale_customer_id, sale_subtotal, sale_vat, sale_total, sale_payment_method, sale_staff_user_id, sale_staff_name, sale_staff_role, sale_items);
  select id into first_payment_id from public.payments where order_id = new_order.id order by created_at desc limit 1;
  update public.payments set method = (sale_split_payments->0->>'method')::public.payment_method, amount = (sale_split_payments->0->>'amount')::numeric where id = first_payment_id;
  insert into public.payments (order_id, method, status, amount, currency, provider) values (new_order.id, (sale_split_payments->1->>'method')::public.payment_method, 'SUCCESS', (sale_split_payments->1->>'amount')::numeric, 'KES', 'DANTOWN_POS_SPLIT');
  return new_order;
end;
$$;
revoke all on function public.complete_pos_sale_split(text, uuid, numeric, numeric, numeric, public.payment_method, uuid, text, text, jsonb, jsonb) from public;
grant execute on function public.complete_pos_sale_split(text, uuid, numeric, numeric, numeric, public.payment_method, uuid, text, text, jsonb, jsonb) to service_role;
notify pgrst, 'reload schema';