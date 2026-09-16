-- Qualify table columns that share names with function parameters.
create or replace function public.process_return(
  order_id uuid,
  refund_reason text,
  refund_amount numeric,
  staff_user_id uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  target_order public.orders;
  target_payment public.payments;
  refund_record public.refunds;
  item record;
  total_refunded numeric := 0;
  new_order_status public.order_status;
  new_payment_status public.payment_status;
begin
  select * into target_order
  from public.orders o
  where o.id = order_id
  for update;
  if not found then raise exception 'Order not found'; end if;
  if target_order.order_status in ('CANCELLED', 'REFUNDED') then
    raise exception 'This order cannot be refunded';
  end if;

  select * into target_payment
  from public.payments p
  where p.order_id = target_order.id
  for update;
  if not found then raise exception 'Payment record not found'; end if;
  if target_payment.status not in ('SUCCESS', 'PARTIALLY_REFUNDED') then
    raise exception 'Payment must be successful to process a refund';
  end if;
  if refund_amount <= 0 or refund_amount > target_payment.amount then
    raise exception 'Invalid refund amount';
  end if;

  insert into public.refunds (payment_id, amount, reason, status, requested_by)
    values (target_payment.id, refund_amount, refund_reason, 'SUCCESS', staff_user_id)
    returning * into refund_record;

  for item in
    select oi.product_id, oi.quantity
    from public.order_items oi
    where oi.order_id = target_order.id
      and oi.product_id is not null
  loop
    update public.inventory
      set quantity = quantity + item.quantity
      where id = (
        select i.id
        from public.inventory i
        where i.product_id = item.product_id
        order by i.quantity desc
        limit 1
      );
    insert into public.inventory_movements
      (product_id, warehouse_id, quantity, movement_type, reference_type, reference_id, created_by)
      select item.product_id, i.warehouse_id, item.quantity,
        'RETURN'::public.inventory_movement_type, 'order', target_order.id, staff_user_id
      from public.inventory i
      where i.product_id = item.product_id
      limit 1;
  end loop;

  total_refunded := refund_amount;
  if total_refunded >= target_payment.amount then
    new_payment_status := 'REFUNDED'::public.payment_status;
    new_order_status := 'REFUNDED'::public.order_status;
  else
    new_payment_status := 'PARTIALLY_REFUNDED'::public.payment_status;
    new_order_status := 'PARTIALLY_REFUNDED'::public.order_status;
  end if;

  update public.payments
    set status = new_payment_status
    where id = target_payment.id;
  update public.orders
    set order_status = new_order_status, payment_status = new_payment_status
    where id = target_order.id;

  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data)
    values (
      staff_user_id, 'RETURN_PROCESSED', 'order', target_order.id,
      jsonb_build_object(
        'refund_amount', refund_amount,
        'reason', refund_reason,
        'refund_id', refund_record.id
      )
    );

  return jsonb_build_object(
    'refund_id', refund_record.id,
    'order_status', new_order_status,
    'payment_status', new_payment_status,
    'refunded_amount', refund_amount
  );
end;
$$;

revoke all on function public.process_return(uuid, text, numeric, uuid) from public;
grant execute on function public.process_return(uuid, text, numeric, uuid) to service_role;

create or replace function public.release_online_order(
  order_id uuid,
  release_reason text default 'Order cancelled'
)
returns public.orders
language plpgsql
set search_path = public
as $$
declare
  target_order public.orders;
  item record;
begin
  select * into target_order
  from public.orders o
  where o.id = order_id
  for update;
  if not found then raise exception 'Order not found'; end if;
  if target_order.sales_channel <> 'ONLINE' then
    raise exception 'Only online orders can release reservations';
  end if;
  if target_order.order_status in ('CANCELLED', 'REFUNDED') then
    return target_order;
  end if;

  for item in
    select oi.product_id, oi.quantity
    from public.order_items oi
    where oi.order_id = target_order.id
      and oi.product_id is not null
  loop
    update public.inventory
      set reserved_quantity = greatest(0, reserved_quantity - item.quantity)
      where id = (
        select i.id
        from public.inventory i
        where i.product_id = item.product_id
        order by i.quantity desc
        limit 1
      );
  end loop;

  update public.orders
    set order_status = 'CANCELLED',
      payment_status = 'CANCELLED',
      notes = coalesce(notes, '') || E'\n' || release_reason
    where id = target_order.id
    returning * into target_order;

  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data)
    values (
      target_order.created_by, 'ONLINE_ORDER_CANCELLED', 'order', target_order.id,
      jsonb_build_object('reason', release_reason)
    );
  return target_order;
end;
$$;

revoke all on function public.release_online_order(uuid, text) from public;
grant execute on function public.release_online_order(uuid, text) to service_role;
