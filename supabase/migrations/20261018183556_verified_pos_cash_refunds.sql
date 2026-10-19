create or replace function public.process_return(
  order_id uuid,
  refund_reason text,
  refund_amount numeric,
  staff_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  target_order public.orders;
  target_payment public.payments;
  refund_record public.refunds;
  target_session public.pos_sessions;
  target_inventory public.inventory;
  item record;
  previously_refunded numeric(12,2);
  total_refunded numeric(12,2);
  successful_payment_count integer;
  open_session_count integer;
  previous_quantity integer;
  new_order_status public.order_status;
  new_payment_status public.payment_status;
  restocked_now boolean := false;
begin
  if order_id is null or staff_user_id is null then
    raise exception 'An order and authenticated staff member are required';
  end if;
  if refund_reason is null or length(btrim(refund_reason)) < 3 or length(refund_reason) > 240 then
    raise exception 'Refund reason must contain between 3 and 240 characters';
  end if;
  if refund_amount is null or refund_amount <= 0 then
    raise exception 'Refund amount must be greater than zero';
  end if;
  if refund_amount <> round(refund_amount, 2) then
    raise exception 'Refund amount must use no more than two decimal places';
  end if;

  select * into target_order
  from public.orders o
  where o.id = process_return.order_id
  for update;
  if not found then raise exception 'Order not found'; end if;
  if target_order.order_status in ('CANCELLED', 'REFUNDED') then
    raise exception 'This order cannot be refunded';
  end if;

  select count(*) into successful_payment_count
  from public.payments p
  where p.order_id = target_order.id
    and p.status in ('SUCCESS', 'PARTIALLY_REFUNDED');
  if successful_payment_count <> 1 then
    raise exception 'Refunds currently require exactly one successful payment record; reconcile split payments manually';
  end if;

  select * into target_payment
  from public.payments p
  where p.order_id = target_order.id
    and p.status in ('SUCCESS', 'PARTIALLY_REFUNDED')
  for update;
  if target_payment.method <> 'CASH' then
    raise exception 'This workflow only records cash refunds; complete electronic refunds through the payment provider first';
  end if;

  select count(*) into open_session_count
  from public.pos_sessions s
  where s.employee_id = staff_user_id and s.status = 'OPEN';
  if open_session_count <> 1 then
    raise exception 'Exactly one open cash session is required to record a cash refund';
  end if;

  select * into target_session
  from public.pos_sessions s
  where s.employee_id = staff_user_id and s.status = 'OPEN'
  limit 1
  for update;
  if not found then
    raise exception 'Cash session is no longer open';
  end if;

  select coalesce(sum(r.amount), 0)::numeric(12,2)
    into previously_refunded
  from public.refunds r
  where r.payment_id = target_payment.id
    and r.status in ('SUCCESS', 'PENDING', 'PROCESSING');
  if refund_amount > target_payment.amount - previously_refunded then
    raise exception 'Refund exceeds the remaining refundable balance';
  end if;

  insert into public.refunds (payment_id, amount, reason, status, requested_by, approved_by)
  values (target_payment.id, refund_amount, btrim(refund_reason), 'SUCCESS', staff_user_id, staff_user_id)
  returning * into refund_record;

  total_refunded := previously_refunded + refund_amount;
  insert into public.cash_movements (session_id, movement_type, amount, reason, created_by)
  values (
    target_session.id,
    'REFUND',
    refund_amount,
    'Cash refund ' || target_order.order_number || ': ' || refund_record.id::text,
    staff_user_id
  );

  if total_refunded >= target_payment.amount then
    if not exists (
      select 1 from public.inventory_movements im
      where im.movement_type = 'RETURN'::public.inventory_movement_type
        and im.reference_type = 'order'
        and im.reference_id = target_order.id
    ) then
      for item in
        select oi.product_id, oi.variant_id, oi.quantity
        from public.order_items oi
        where oi.order_id = target_order.id
          and oi.product_id is not null
        order by oi.product_id, oi.variant_id
      loop
        perform pg_advisory_xact_lock(hashtextextended(
          'pos.return-inventory:' || item.product_id::text || ':' ||
          coalesce(item.variant_id::text, 'null') || ':' || target_session.warehouse_id::text,
          0
        ));

        select * into target_inventory
        from public.inventory i
        where i.product_id = item.product_id
          and i.variant_id is not distinct from item.variant_id
          and i.warehouse_id = target_session.warehouse_id
        order by i.location_id nulls first
        limit 1
        for update;

        if found then
          previous_quantity := target_inventory.quantity;
          update public.inventory
          set quantity = quantity + item.quantity
          where id = target_inventory.id
          returning * into target_inventory;
        else
          previous_quantity := 0;
          insert into public.inventory (product_id, variant_id, warehouse_id, quantity)
          values (item.product_id, item.variant_id, target_session.warehouse_id, item.quantity)
          returning * into target_inventory;
        end if;

        insert into public.inventory_movements (
          product_id, variant_id, warehouse_id, quantity, movement_type, reference_type, reference_id,
          previous_quantity, new_quantity, created_by
        ) values (
          item.product_id, item.variant_id, target_session.warehouse_id, item.quantity,
          'RETURN'::public.inventory_movement_type, 'refund', refund_record.id,
          previous_quantity, target_inventory.quantity, staff_user_id
        );
      end loop;
      restocked_now := true;
    end if;

    update public.pos_transactions
    set status = 'REFUNDED'
    where order_id = target_order.id;

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
    staff_user_id,
    'RETURN_PROCESSED',
    'order',
    target_order.id,
    jsonb_build_object(
      'refund_amount', refund_amount,
      'cumulative_refund_amount', total_refunded,
      'reason', refund_reason,
      'refund_id', refund_record.id,
      'session_id', target_session.id,
      'cash_refund_confirmed', true,
      'inventory_restocked', restocked_now
    )
  );

  return jsonb_build_object(
    'refund_id', refund_record.id,
    'order_status', new_order_status,
    'payment_status', new_payment_status,
    'refunded_amount', refund_amount,
    'cumulative_refunded_amount', total_refunded,
    'inventory_restocked', restocked_now,
    'cash_session_id', target_session.id
  );
end;
$$;

revoke all on function public.process_return(uuid, text, numeric, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.process_return(uuid, text, numeric, uuid) to service_role;