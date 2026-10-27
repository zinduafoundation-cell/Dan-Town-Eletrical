alter table public.order_items
  add column if not exists source_warehouse_id uuid references public.warehouses(id) on delete set null;

create index if not exists order_items_source_warehouse_idx
  on public.order_items(source_warehouse_id)
  where source_warehouse_id is not null;

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
  allocation jsonb;
  allocations jsonb := '[]'::jsonb;
  product_record public.products;
  inventory_record public.inventory;
  requested_quantity integer;
  calculated_subtotal numeric := 0;
  calculated_vat numeric := 0;
begin
  if requested_items is null or jsonb_typeof(requested_items) is distinct from 'array' then
    raise exception 'An order must contain at least one item';
  end if;
  if jsonb_array_length(requested_items) = 0 then
    raise exception 'An order must contain at least one item';
  end if;
  if fulfillment_type not in ('pickup', 'delivery') then
    raise exception 'Invalid fulfillment type';
  end if;
  if delivery_fee < 0 then
    raise exception 'Delivery fee cannot be negative';
  end if;

  for item in
    select requested.value
    from jsonb_array_elements(requested_items) as requested(value)
    order by requested.value->>'product_id'
  loop
    requested_quantity := (item->>'quantity')::integer;
    if requested_quantity < 1 then
      raise exception 'Quantity must be positive';
    end if;

    select *
    into product_record
    from public.products
    where id = (item->>'product_id')::uuid
      and is_active = true
      and status = 'ACTIVE';
    if not found then
      raise exception 'A selected product is unavailable';
    end if;

    select inventory_row.*
    into inventory_record
    from public.inventory as inventory_row
    join public.warehouses as warehouse
      on warehouse.id = inventory_row.warehouse_id
    where inventory_row.product_id = product_record.id
      and inventory_row.variant_id is null
      and inventory_row.location_id is null
      and warehouse.is_active = true
      and inventory_row.quantity - inventory_row.reserved_quantity >= requested_quantity
    order by
      inventory_row.quantity - inventory_row.reserved_quantity desc,
      inventory_row.warehouse_id
    limit 1
    for update of inventory_row;

    if not found then
      raise exception 'Insufficient stock at any single active warehouse for %', product_record.name;
    end if;

    update public.inventory
    set reserved_quantity = reserved_quantity + requested_quantity
    where id = inventory_record.id;

    allocations := allocations || jsonb_build_array(jsonb_build_object(
      'product_id', product_record.id,
      'warehouse_id', inventory_record.warehouse_id,
      'quantity', requested_quantity
    ));
    calculated_subtotal := calculated_subtotal + product_record.retail_price * requested_quantity;
    calculated_vat := calculated_vat + round(product_record.retail_price * requested_quantity * product_record.vat_rate / 100, 2);
  end loop;

  select *
  into customer_record
  from public.customers
  where buyer_user_id is not null
    and user_id = buyer_user_id
  limit 1;

  if not found and nullif(customer_email, '') is not null then
    select *
    into customer_record
    from public.customers
    where user_id is null
      and email = nullif(customer_email, '')
      and status = 'ACTIVE'
    order by created_at
    limit 1;
  end if;

  if not found and nullif(customer_phone, '') is not null then
    select *
    into customer_record
    from public.customers
    where user_id is null
      and phone = nullif(customer_phone, '')
      and status = 'ACTIVE'
    order by created_at
    limit 1;
  end if;

  if not found then
    insert into public.customers (user_id, name, phone, email, customer_type, status)
    values (buyer_user_id, customer_name, nullif(customer_phone, ''), nullif(customer_email, ''), 'RETAIL', 'ACTIVE')
    returning * into customer_record;
  else
    update public.customers
    set user_id = coalesce(customer_record.user_id, buyer_user_id),
        email = coalesce(nullif(customer_email, ''), customer_record.email),
        phone = coalesce(nullif(customer_phone, ''), customer_record.phone),
        updated_at = timezone('utc', now())
    where id = customer_record.id
    returning * into customer_record;
  end if;

  insert into public.orders (
    order_number, customer_id, subtotal, discount, vat, delivery_fee, total,
    payment_status, order_status, created_by, sales_channel, shipping_address, notes
  )
  values (
    order_number, customer_record.id, calculated_subtotal, 0, calculated_vat, delivery_fee,
    calculated_subtotal + calculated_vat + delivery_fee, 'PENDING', 'PENDING', buyer_user_id, 'ONLINE',
    shipping_details, 'Fulfillment: ' || fulfillment_type
  )
  returning * into new_order;

  for allocation in
    select allocated.value
    from jsonb_array_elements(allocations) as allocated(value)
  loop
    select *
    into product_record
    from public.products
    where id = (allocation->>'product_id')::uuid;

    insert into public.order_items (
      order_id, product_id, variant_id, source_warehouse_id,
      product_name_snapshot, sku_snapshot, unit_price, quantity, discount, vat, line_total
    )
    values (
      new_order.id, product_record.id, null, (allocation->>'warehouse_id')::uuid,
      product_record.name, product_record.sku, product_record.retail_price,
      (allocation->>'quantity')::integer, 0,
      round(product_record.retail_price * (allocation->>'quantity')::integer * product_record.vat_rate / 100, 2),
      product_record.retail_price * (allocation->>'quantity')::integer
    );
  end loop;

  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data)
  values (
    buyer_user_id,
    'ONLINE_ORDER_CREATED',
    'order',
    new_order.id,
    jsonb_build_object(
      'order_number', new_order.order_number,
      'sales_channel', 'ONLINE',
      'reserved_items', requested_items,
      'source_warehouses', allocations
    )
  );
  return new_order;
end;
$$;

revoke all on function public.create_online_order(text, uuid, text, text, text, text, jsonb, numeric, jsonb) from public;
grant execute on function public.create_online_order(text, uuid, text, text, text, text, jsonb, numeric, jsonb) to service_role;