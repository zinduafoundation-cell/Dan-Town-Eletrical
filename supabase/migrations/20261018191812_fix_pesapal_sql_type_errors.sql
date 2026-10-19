create or replace function public.create_pos_pesapal_order(
  sale_order_number text,
  sale_customer_id uuid,
  sale_customer_name text,
  sale_staff_user_id uuid,
  sale_staff_name text,
  sale_staff_role text,
  sale_items jsonb
)
returns public.orders
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  new_order public.orders;
  item jsonb;
  product_row public.products;
  inventory_row public.inventory;
  subtotal numeric := 0;
  vat numeric := 0;
  requested_quantity integer;
begin
  select * into new_order
  from public.orders
  where order_number = sale_order_number
  for update;
  if found then
    if new_order.sales_channel <> 'POS'
      or new_order.payment_status <> 'PENDING'
      or new_order.created_by is distinct from sale_staff_user_id
      or new_order.customer_id is distinct from sale_customer_id then
      raise exception 'POS checkout request conflicts with an existing order';
    end if;
    if exists (
      select 1
      from (
        (
          select oi.product_id, sum(oi.quantity)::integer as quantity
          from public.order_items oi
          where oi.order_id = new_order.id
          group by oi.product_id
          except
          select t."productId", sum(t.quantity)::integer
          from jsonb_to_recordset(sale_items) as t("productId" uuid, quantity integer)
          group by t."productId"
        )
        union all
        (
          select t."productId", sum(t.quantity)::integer
          from jsonb_to_recordset(sale_items) as t("productId" uuid, quantity integer)
          group by t."productId"
          except
          select oi.product_id, sum(oi.quantity)::integer
          from public.order_items oi
          where oi.order_id = new_order.id
          group by oi.product_id
        )
      ) as item_differences
    ) then
      raise exception 'POS checkout request was reused with different sale items';
    end if;
    return new_order;
  end if;

  if sale_items is null or jsonb_typeof(sale_items) <> 'array' or jsonb_array_length(sale_items) = 0 then
    raise exception 'A sale must contain at least one item';
  end if;
  for item in
    select jsonb_build_object('productId', t."productId", 'quantity', sum(t.quantity))
    from jsonb_to_recordset(sale_items) as t("productId" uuid, quantity integer)
    group by t."productId"
    order by t."productId"
  loop
    requested_quantity := (item->>'quantity')::integer;
    if requested_quantity < 1 then raise exception 'Sale quantities must be positive'; end if;
    select * into product_row
    from public.products
    where id = (item->>'productId')::uuid and is_active = true
    for share;
    if not found then raise exception 'Product is unavailable'; end if;
    select * into inventory_row
    from public.inventory
    where product_id = product_row.id
    order by quantity desc
    limit 1
    for update;
    if not found or inventory_row.quantity - inventory_row.reserved_quantity < requested_quantity then
      raise exception 'Insufficient stock for %', product_row.name;
    end if;
    subtotal := subtotal + product_row.retail_price * requested_quantity;
    vat := vat + round(product_row.retail_price * requested_quantity * product_row.vat_rate / 100, 2);
  end loop;

  insert into public.orders (
    order_number, customer_id, subtotal, vat, total, payment_status, order_status,
    created_by, processed_by_user_id, processed_by_staff_name, processed_by_staff_role, sales_channel
  )
  values (
    sale_order_number,
    sale_customer_id, subtotal, vat, subtotal + vat, 'PENDING', 'PAYMENT_PENDING',
    sale_staff_user_id, sale_staff_user_id, sale_staff_name, sale_staff_role,
    'POS'
  )
  returning * into new_order;

  for item in
    select jsonb_build_object('productId', t."productId", 'quantity', sum(t.quantity))
    from jsonb_to_recordset(sale_items) as t("productId" uuid, quantity integer)
    group by t."productId"
    order by t."productId"
  loop
    select * into product_row from public.products where id = (item->>'productId')::uuid;
    insert into public.order_items (
      order_id, product_id, product_name_snapshot, sku_snapshot, unit_price, quantity, line_total, vat
    )
    values (
      new_order.id, product_row.id, product_row.name, product_row.sku,
      product_row.retail_price, (item->>'quantity')::integer,
      product_row.retail_price * (item->>'quantity')::integer,
      round(product_row.retail_price * (item->>'quantity')::integer * product_row.vat_rate / 100, 2)
    );
  end loop;

  insert into public.payments (order_id, method, status, amount, currency, provider)
  values (new_order.id, 'CARD', 'PENDING', new_order.total, 'KES', 'PESAPAL');
  return new_order;
end;
$$;

create or replace function public.complete_pesapal_payment(
  target_order_id uuid,
  target_provider_reference text,
  provider_amount numeric,
  provider_method public.payment_method,
  provider_payload jsonb
)
returns public.orders
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  target_order public.orders;
  target_payment public.payments;
  target_transaction public.payment_transactions;
  item record;
  inventory_row public.inventory;
begin
  if provider_method not in ('MPESA', 'CARD', 'BANK_TRANSFER') then
    raise exception 'Unsupported Pesapal payment method';
  end if;

  select * into target_order
  from public.orders o
  where o.id = target_order_id
  for update;
  if not found then raise exception 'Order not found'; end if;
  if target_order.sales_channel not in ('ONLINE', 'POS') then
    raise exception 'Order channel is not supported for Pesapal';
  end if;
  if round(provider_amount, 2) <> round(target_order.total, 2) then
    raise exception 'Payment amount does not match order total';
  end if;

  select * into target_payment
  from public.payments p
  where p.order_id = target_order.id
    and p.provider = 'PESAPAL'
  order by p.created_at desc
  limit 1
  for update;
  if not found then raise exception 'Pesapal payment record not found'; end if;

  select * into target_transaction
  from public.payment_transactions pt
  where pt.provider_reference = target_provider_reference
  for update;
  if not found or target_transaction.payment_id <> target_payment.id then
    raise exception 'Pesapal transaction is not linked to this order';
  end if;
  if target_order.payment_status = 'SUCCESS'
    and target_transaction.status = 'SUCCESS' then
    return target_order;
  end if;
  if target_order.payment_status <> 'PENDING'
    or target_order.order_status not in ('PENDING', 'PAYMENT_PENDING')
    or target_payment.status <> 'PENDING'
    or target_transaction.status <> 'PENDING' then
    raise exception 'Order is not awaiting Pesapal payment';
  end if;

  if target_order.sales_channel = 'ONLINE' then
    for item in
      select oi.product_id, sum(oi.quantity)::integer as quantity
      from public.order_items oi
      where oi.order_id = target_order.id
        and oi.product_id is not null
      group by oi.product_id
      order by oi.product_id
    loop
      select * into inventory_row
      from public.inventory i
      where i.product_id = item.product_id
        and i.reserved_quantity >= item.quantity
      order by i.quantity desc
      limit 1
      for update;
      if not found then raise exception 'Reserved stock is unavailable'; end if;

      update public.inventory
      set quantity = quantity - item.quantity,
          reserved_quantity = reserved_quantity - item.quantity
      where id = inventory_row.id
        and quantity >= item.quantity
        and reserved_quantity >= item.quantity;
      if not found then raise exception 'Reserved stock is unavailable'; end if;
    end loop;
  else
    for item in
      select oi.product_id, sum(oi.quantity)::integer as quantity
      from public.order_items oi
      where oi.order_id = target_order.id
        and oi.product_id is not null
      group by oi.product_id
      order by oi.product_id
    loop
      update public.inventory i
      set quantity = i.quantity - item.quantity
      where i.id = (
        select available.id
        from public.inventory available
        where available.product_id = item.product_id
          and available.quantity - available.reserved_quantity >= item.quantity
        order by available.quantity desc
        limit 1
        for update
      );
      if not found then raise exception 'Insufficient stock while completing payment'; end if;
    end loop;
  end if;

  update public.payment_transactions
  set response_payload = provider_payload,
      status = 'SUCCESS',
      processed_at = timezone('utc', now())
  where id = target_transaction.id;

  update public.payments
  set status = 'SUCCESS',
      method = provider_method,
      provider = 'PESAPAL'
  where id = target_payment.id;

  update public.orders
  set payment_status = 'SUCCESS',
      order_status = case
        when sales_channel = 'ONLINE' then 'PROCESSING'::public.order_status
        else 'PAID'::public.order_status
      end,
      notes = coalesce(notes, '') || E'\n' || 'Pesapal payment confirmed.'
  where id = target_order.id
  returning * into target_order;

  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data)
  values (
    target_order.created_by,
    'PESAPAL_PAYMENT_COMPLETED',
    'order',
    target_order.id,
    jsonb_build_object(
      'provider_reference', target_provider_reference,
      'amount', target_order.total,
      'sales_channel', target_order.sales_channel
    )
  );

  return target_order;
end;
$$;

revoke all on function public.create_pos_pesapal_order(text, uuid, text, uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.complete_pesapal_payment(uuid, text, numeric, public.payment_method, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_pos_pesapal_order(text, uuid, text, uuid, text, text, jsonb)
  to service_role;
grant execute on function public.complete_pesapal_payment(uuid, text, numeric, public.payment_method, jsonb)
  to service_role;