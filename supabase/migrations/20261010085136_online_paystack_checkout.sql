alter table public.orders
  add column if not exists payment_access_token_hash text;

create or replace function public.prepare_online_paystack_payment(target_order_id uuid)
returns public.payments
language plpgsql
set search_path = public
as $$
declare
  target_order public.orders;
  target_payment public.payments;
begin
  select * into target_order
  from public.orders o
  where o.id = target_order_id
  for update;
  if not found then raise exception 'Order not found'; end if;
  if target_order.sales_channel <> 'ONLINE' then raise exception 'Order is not an online order'; end if;
  if target_order.payment_status <> 'PENDING'
    or target_order.order_status not in ('PENDING', 'PAYMENT_PENDING') then
    raise exception 'Order is not awaiting payment';
  end if;

  select * into target_payment
  from public.payments p
  where p.order_id = target_order.id
    and p.provider = 'PAYSTACK'
    and p.status = 'PENDING'
  order by p.created_at desc
  limit 1
  for update;
  if not found then
    insert into public.payments (order_id, method, status, amount, currency, provider)
    values (target_order.id, 'CARD', 'PENDING', target_order.total, 'KES', 'PAYSTACK')
    returning * into target_payment;
  end if;

  return target_payment;
end;
$$;

create or replace function public.finish_online_paystack_sandbox_test(
  target_order_id uuid,
  target_provider_reference text,
  provider_amount integer,
  provider_payload jsonb
)
returns public.orders
language plpgsql
set search_path = public
as $$
declare
  target_order public.orders;
  target_payment public.payments;
  target_transaction public.payment_transactions;
  item record;
  inventory_row public.inventory;
begin
  select * into target_order
  from public.orders o
  where o.id = target_order_id
  for update;
  if not found then raise exception 'Order not found'; end if;
  if target_order.sales_channel <> 'ONLINE' then raise exception 'Order is not an online order'; end if;
  if round(provider_amount / 100.0, 2) <> round(target_order.total, 2) then
    raise exception 'Payment amount does not match order total';
  end if;

  select * into target_payment
  from public.payments p
  where p.order_id = target_order.id
    and p.provider = 'PAYSTACK'
  order by p.created_at desc
  limit 1
  for update;
  if not found then raise exception 'Paystack payment record not found'; end if;

  select * into target_transaction
  from public.payment_transactions pt
  where pt.provider_reference = target_provider_reference
  for update;
  if not found then raise exception 'Paystack reference is not linked to this order'; end if;
  if target_transaction.payment_id <> target_payment.id then
    raise exception 'Paystack reference is linked to another payment';
  end if;
  if target_transaction.status = 'SUCCESS'
    and target_order.payment_status = 'CANCELLED'
    and target_order.order_status = 'CANCELLED' then
    return target_order;
  end if;
  if target_order.payment_status <> 'PENDING'
    or target_order.order_status not in ('PENDING', 'PAYMENT_PENDING') then
    raise exception 'Order is not awaiting sandbox payment';
  end if;

  for item in
    select oi.product_id, sum(oi.quantity)::integer as quantity
    from public.order_items oi
    where oi.order_id = target_order.id
      and oi.product_id is not null
    group by oi.product_id
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
    set reserved_quantity = reserved_quantity - item.quantity
    where id = inventory_row.id;
  end loop;

  update public.payment_transactions
  set response_payload = provider_payload,
      status = 'SUCCESS',
      processed_at = timezone('utc', now())
  where id = target_transaction.id;

  update public.payments
  set status = 'CANCELLED', provider = 'PAYSTACK'
  where id = target_payment.id;

  update public.orders
  set payment_status = 'CANCELLED',
      order_status = 'CANCELLED',
      notes = coalesce(notes, '') || E'\n' || 'Paystack sandbox test completed; no payment collected.'
  where id = target_order.id
  returning * into target_order;

  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data)
  values (
    target_order.created_by, 'PAYSTACK_SANDBOX_TEST_COMPLETED', 'order', target_order.id,
    jsonb_build_object('provider_reference', target_provider_reference, 'sandbox_success', true, 'real_payment_collected', false)
  );

  return target_order;
end;
$$;

revoke all on function public.prepare_online_paystack_payment(uuid) from public;
revoke all on function public.finish_online_paystack_sandbox_test(uuid, text, integer, jsonb) from public;
grant execute on function public.prepare_online_paystack_payment(uuid) to service_role;
grant execute on function public.finish_online_paystack_sandbox_test(uuid, text, integer, jsonb) to service_role;
