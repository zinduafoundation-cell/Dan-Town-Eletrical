-- Make POS checkout authoritative: price, VAT, stock and audit data are
-- calculated in the same transaction instead of trusting the browser payload.
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
security invoker
set search_path = public
as $$
declare
  new_order public.orders;
  sale_item record;
  product_row public.products;
  inventory_row public.inventory;
  requested_quantity integer;
  calculated_subtotal numeric := 0;
  calculated_vat numeric := 0;
  previous_quantity integer;
  new_quantity integer;
begin
  if coalesce(nullif(btrim(sale_order_number), ''), '') = '' then
    raise exception 'A sale order number is required';
  end if;
  if jsonb_typeof(sale_items) <> 'array' or jsonb_array_length(sale_items) = 0 then
    raise exception 'A sale must contain at least one item';
  end if;

  -- Aggregate duplicate product lines before locking stock. Without this, two
  -- lines for one product could each pass validation against the same quantity.
  for sale_item in
    select
      (entry.value ->> 'product_id')::uuid as product_id,
      sum((entry.value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(sale_items) as entry(value)
    group by (entry.value ->> 'product_id')::uuid
  loop
    requested_quantity := sale_item.quantity;
    if requested_quantity < 1 then
      raise exception 'Quantity must be positive';
    end if;

    select * into product_row
    from public.products
    where id = sale_item.product_id and is_active = true and status = 'ACTIVE';
    if not found then
      raise exception 'A selected product is unavailable';
    end if;

    select * into inventory_row
    from public.inventory
    where product_id = product_row.id
    order by quantity desc, id
    limit 1
    for update;
    if not found or inventory_row.quantity - inventory_row.reserved_quantity < requested_quantity then
      raise exception 'Insufficient stock for %', product_row.name;
    end if;

    calculated_subtotal := calculated_subtotal + product_row.retail_price * requested_quantity;
    calculated_vat := calculated_vat + round(product_row.retail_price * requested_quantity * product_row.vat_rate / 100, 2);
  end loop;

  if round(coalesce(sale_subtotal, -1), 2) <> round(calculated_subtotal, 2)
    or round(coalesce(sale_vat, -1), 2) <> round(calculated_vat, 2)
    or round(coalesce(sale_total, -1), 2) <> round(calculated_subtotal + calculated_vat, 2) then
    raise exception 'Sale totals do not match current product prices and VAT';
  end if;

  insert into public.orders (
    order_number, customer_id, subtotal, discount, vat, delivery_fee, total,
    payment_status, order_status, created_by, sales_channel, processed_by_user_id,
    processed_by_staff_name, processed_by_staff_role
  ) values (
    sale_order_number, sale_customer_id, calculated_subtotal, 0, calculated_vat, 0,
    calculated_subtotal + calculated_vat, 'SUCCESS', 'PAID', sale_staff_user_id,
    'POS', sale_staff_user_id, sale_staff_name, sale_staff_role
  ) returning * into new_order;

  for sale_item in
    select
      (entry.value ->> 'product_id')::uuid as product_id,
      sum((entry.value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(sale_items) as entry(value)
    group by (entry.value ->> 'product_id')::uuid
  loop
    select * into product_row from public.products where id = sale_item.product_id;
    select * into inventory_row
    from public.inventory
    where product_id = product_row.id
    order by quantity desc, id
    limit 1
    for update;

    previous_quantity := inventory_row.quantity;
    update public.inventory
    set quantity = quantity - sale_item.quantity
    where id = inventory_row.id
    returning quantity into new_quantity;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name_snapshot, sku_snapshot,
      unit_price, quantity, discount, vat, line_total
    ) values (
      new_order.id, product_row.id, null, product_row.name, product_row.sku,
      product_row.retail_price, sale_item.quantity, 0,
      round(product_row.retail_price * sale_item.quantity * product_row.vat_rate / 100, 2),
      product_row.retail_price * sale_item.quantity
    );

    insert into public.inventory_movements (
      product_id, variant_id, warehouse_id, quantity, movement_type,
      reference_type, reference_id, previous_quantity, new_quantity, created_by
    ) values (
      product_row.id, inventory_row.variant_id, inventory_row.warehouse_id,
      -sale_item.quantity, 'SALE', 'POS_ORDER', new_order.id,
      previous_quantity, new_quantity, sale_staff_user_id
    );
  end loop;

  insert into public.payments (order_id, method, status, amount, currency, provider)
  values (new_order.id, sale_payment_method, 'SUCCESS', new_order.total, 'KES', 'DANTOWN_POS');

  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data)
  values (
    sale_staff_user_id, 'SALE_COMPLETED', 'order', new_order.id,
    jsonb_build_object('order_number', new_order.order_number, 'sales_channel', 'POS', 'total', new_order.total)
  );

  return new_order;
end;
$$;

create or replace function public.complete_pos_sale_split(
  sale_order_number text,
  sale_customer_id uuid,
  sale_subtotal numeric,
  sale_vat numeric,
  sale_total numeric,
  sale_payment_method public.payment_method,
  sale_staff_user_id uuid,
  sale_staff_name text,
  sale_staff_role text,
  sale_items jsonb,
  sale_split_payments jsonb
)
returns public.orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_order public.orders;
  first_payment_id uuid;
  payment record;
  split_total numeric := 0;
begin
  if jsonb_typeof(sale_split_payments) <> 'array' or jsonb_array_length(sale_split_payments) <> 2 then
    raise exception 'Split sale requires exactly two payments';
  end if;

  for payment in
    select (entry.value ->> 'method')::public.payment_method as method,
           (entry.value ->> 'amount')::numeric as amount
    from jsonb_array_elements(sale_split_payments) as entry(value)
  loop
    if payment.amount <= 0 then
      raise exception 'Split payment amounts must be positive';
    end if;
    split_total := split_total + payment.amount;
  end loop;

  if (sale_split_payments -> 0 ->> 'method') = (sale_split_payments -> 1 ->> 'method') then
    raise exception 'Split payment methods must be different';
  end if;
  if round(split_total, 2) <> round(sale_total, 2) then
    raise exception 'Split payments must equal sale total';
  end if;

  select * into new_order from public.complete_pos_sale(
    sale_order_number, sale_customer_id, sale_subtotal, sale_vat, sale_total,
    sale_payment_method, sale_staff_user_id, sale_staff_name, sale_staff_role, sale_items
  );

  select id into first_payment_id
  from public.payments
  where order_id = new_order.id
  order by created_at desc, id desc
  limit 1;

  update public.payments
  set method = (sale_split_payments -> 0 ->> 'method')::public.payment_method,
      amount = (sale_split_payments -> 0 ->> 'amount')::numeric
  where id = first_payment_id;

  insert into public.payments (order_id, method, status, amount, currency, provider)
  values (
    new_order.id,
    (sale_split_payments -> 1 ->> 'method')::public.payment_method,
    'SUCCESS',
    (sale_split_payments -> 1 ->> 'amount')::numeric,
    'KES',
    'DANTOWN_POS_SPLIT'
  );

  return new_order;
end;
$$;

revoke all on function public.complete_pos_sale(text, uuid, numeric, numeric, numeric, public.payment_method, uuid, text, text, jsonb) from public;
grant execute on function public.complete_pos_sale(text, uuid, numeric, numeric, numeric, public.payment_method, uuid, text, text, jsonb) to service_role;
revoke all on function public.complete_pos_sale_split(text, uuid, numeric, numeric, numeric, public.payment_method, uuid, text, text, jsonb, jsonb) from public;
grant execute on function public.complete_pos_sale_split(text, uuid, numeric, numeric, numeric, public.payment_method, uuid, text, text, jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';
