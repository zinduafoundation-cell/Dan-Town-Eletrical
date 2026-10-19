alter table public.pos_sessions
  add column if not exists opening_notes text not null default '',
  add column if not exists closing_notes text not null default '';

revoke all on table public.pos_sessions, public.cash_movements,
  public.pos_transactions, public.pos_transaction_items
  from public, anon, authenticated;
grant all on table public.pos_sessions, public.cash_movements,
  public.pos_transactions, public.pos_transaction_items to service_role;

create or replace function public.open_pos_cash_session(
  target_employee_id uuid,
  target_warehouse_id uuid,
  target_opening_balance numeric,
  target_opening_notes text default ''
)
returns public.pos_sessions
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  existing_session_id uuid;
  opened_session public.pos_sessions;
begin
  if target_employee_id is null or target_warehouse_id is null then
    raise exception 'A staff member and active warehouse are required';
  end if;
  if target_opening_balance is null or target_opening_balance < 0 then
    raise exception 'Opening float must be zero or more';
  end if;
  if target_opening_balance <> round(target_opening_balance, 2) then
    raise exception 'Opening float must use no more than two decimal places';
  end if;
  if not exists (
    select 1 from public.warehouses
    where id = target_warehouse_id and is_active = true
  ) then
    raise exception 'An active warehouse is required to open a cash session';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pos.cash-session:' || target_employee_id::text, 0));

  select id into existing_session_id
  from public.pos_sessions
  where employee_id = target_employee_id and status = 'OPEN'
  order by opened_at desc
  limit 1
  for update;

  if existing_session_id is not null then
    raise exception 'An open cash session already exists for this staff member';
  end if;

  insert into public.pos_sessions (
    employee_id, warehouse_id, opening_balance, opening_notes
  ) values (
    target_employee_id, target_warehouse_id, target_opening_balance, coalesce(target_opening_notes, '')
  ) returning * into opened_session;

  insert into public.cash_movements (session_id, movement_type, amount, reason, created_by)
  values (opened_session.id, 'OPENING', target_opening_balance, nullif(target_opening_notes, ''), target_employee_id);

  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data)
  values (
    target_employee_id,
    'POS_CASH_SESSION_OPENED',
    'pos_session',
    opened_session.id,
    jsonb_build_object(
      'warehouse_id', target_warehouse_id,
      'opening_balance', target_opening_balance,
      'notes', coalesce(target_opening_notes, '')
    )
  );

  return opened_session;
end;
$$;

create or replace function public.close_pos_cash_session(
  target_session_id uuid,
  target_employee_id uuid,
  target_closing_balance numeric,
  target_closing_notes text default ''
)
returns public.pos_sessions
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  target_session public.pos_sessions;
  expected_balance numeric(12,2);
begin
  if target_session_id is null or target_employee_id is null then
    raise exception 'A cash session and staff member are required';
  end if;
  if target_closing_balance is null or target_closing_balance < 0 then
    raise exception 'Counted cash must be zero or more';
  end if;
  if target_closing_balance <> round(target_closing_balance, 2) then
    raise exception 'Counted cash must use no more than two decimal places';
  end if;

  select * into target_session
  from public.pos_sessions
  where id = target_session_id
  for update;

  if not found or target_session.employee_id <> target_employee_id then
    raise exception 'Cash session was not found for this staff member';
  end if;
  if target_session.status <> 'OPEN' then
    raise exception 'Cash session is already closed';
  end if;

  select target_session.opening_balance + coalesce(sum(
    case movement_type
      when 'SALE' then amount
      when 'REFUND' then -amount
      when 'PAID_IN' then amount
      when 'PAID_OUT' then -amount
      else 0
    end
  ), 0)::numeric(12,2)
  into expected_balance
  from public.cash_movements
  where session_id = target_session.id;

  update public.pos_sessions
  set status = 'CLOSED',
      closing_balance = target_closing_balance,
      closing_notes = coalesce(target_closing_notes, ''),
      closed_at = timezone('utc', now())
  where id = target_session.id
  returning * into target_session;

  insert into public.cash_movements (session_id, movement_type, amount, reason, created_by)
  values (target_session.id, 'CLOSING', target_closing_balance, nullif(target_closing_notes, ''), target_employee_id);

  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data)
  values (
    target_employee_id,
    'POS_CASH_SESSION_CLOSED',
    'pos_session',
    target_session.id,
    jsonb_build_object(
      'expected_balance', expected_balance,
      'counted_balance', target_closing_balance,
      'variance', target_closing_balance - expected_balance,
      'notes', coalesce(target_closing_notes, '')
    )
  );

  return target_session;
end;
$$;

create or replace function public.complete_pos_cash_sale(
  sale_order_number text,
  sale_customer_id uuid,
  sale_subtotal numeric,
  sale_vat numeric,
  sale_total numeric,
  sale_staff_user_id uuid,
  sale_staff_name text,
  sale_staff_role text,
  sale_items jsonb,
  sale_cash_received numeric
)
returns public.orders
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  completed_order public.orders;
  active_session public.pos_sessions;
  pos_transaction_id uuid;
  active_session_count integer;
begin
  if sale_cash_received is null or sale_cash_received < 0 then
    raise exception 'Cash received must be zero or more';
  end if;
  if sale_cash_received <> round(sale_cash_received, 2) then
    raise exception 'Cash received must use no more than two decimal places';
  end if;
  if sale_staff_user_id is null then
    raise exception 'An authenticated staff member is required for a cash sale';
  end if;

  select count(*) into active_session_count
  from public.pos_sessions
  where employee_id = sale_staff_user_id and status = 'OPEN';
  if active_session_count <> 1 then
    raise exception 'Exactly one open cash session is required before recording a cash sale';
  end if;

  select * into active_session
  from public.pos_sessions
  where employee_id = sale_staff_user_id and status = 'OPEN'
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Open a cash session before recording a cash sale';
  end if;

  completed_order := public.complete_pos_sale(
    sale_order_number,
    sale_customer_id,
    sale_subtotal,
    sale_vat,
    sale_total,
    'CASH'::public.payment_method,
    sale_staff_user_id,
    sale_staff_name,
    sale_staff_role,
    sale_items
  );

  if sale_cash_received < completed_order.total then
    raise exception 'Cash received is less than the verified sale total';
  end if;

  insert into public.pos_transactions (session_id, order_id, subtotal, total, created_by)
  values (active_session.id, completed_order.id, completed_order.subtotal, completed_order.total, sale_staff_user_id)
  returning id into pos_transaction_id;

  insert into public.pos_transaction_items (
    transaction_id, product_id, variant_id, product_name_snapshot, sku_snapshot, quantity, unit_price, line_total
  )
  select
    pos_transaction_id, product_id, variant_id, product_name_snapshot, coalesce(sku_snapshot, ''),
    quantity, unit_price, line_total
  from public.order_items
  where order_id = completed_order.id;

  insert into public.cash_movements (session_id, movement_type, amount, reason, created_by)
  values (
    active_session.id,
    'SALE',
    completed_order.total,
    'Cash sale ' || completed_order.order_number,
    sale_staff_user_id
  );

  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data)
  values (
    sale_staff_user_id,
    'POS_CASH_COLLECTION_RECORDED',
    'order',
    completed_order.id,
    jsonb_build_object(
      'order_number', completed_order.order_number,
      'session_id', active_session.id,
      'cash_received', sale_cash_received,
      'sale_total', completed_order.total,
      'change_given', sale_cash_received - completed_order.total
    )
  );

  return completed_order;
end;
$$;

revoke all on function public.open_pos_cash_session(uuid, uuid, numeric, text)
  from public, anon, authenticated;
grant execute on function public.open_pos_cash_session(uuid, uuid, numeric, text) to service_role;

revoke all on function public.close_pos_cash_session(uuid, uuid, numeric, text)
  from public, anon, authenticated;
grant execute on function public.close_pos_cash_session(uuid, uuid, numeric, text) to service_role;

revoke all on function public.complete_pos_cash_sale(text, uuid, numeric, numeric, numeric, uuid, text, text, jsonb, numeric)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_pos_cash_sale(text, uuid, numeric, numeric, numeric, uuid, text, text, jsonb, numeric)
  to service_role;