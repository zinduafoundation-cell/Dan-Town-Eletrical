create or replace function public.complete_pos_offline_cash_sale(
  sale_offline_transaction_id uuid,
  sale_offline_device_id text,
  sale_staff_user_id uuid,
  sale_order_number text,
  sale_customer_id uuid,
  sale_subtotal numeric,
  sale_vat numeric,
  sale_total numeric,
  sale_staff_name text,
  sale_staff_role text,
  sale_items jsonb,
  sale_cash_received numeric,
  sale_payload jsonb
)
returns public.orders
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  existing_order public.orders;
  completed_order public.orders;
begin
  if sale_offline_transaction_id is null
    or sale_offline_device_id is null
    or btrim(sale_offline_device_id) = ''
    or sale_staff_user_id is null then
    raise exception 'Offline transaction, device, and staff identities are required';
  end if;

  perform pg_advisory_xact_lock(hashtext(sale_offline_transaction_id::text));

  select * into existing_order
  from public.orders
  where offline_transaction_id = sale_offline_transaction_id
  for update;
  if found then
    if existing_order.offline_device_id <> sale_offline_device_id
      or existing_order.processed_by_user_id <> sale_staff_user_id then
      raise exception 'Offline transaction identity conflicts with an existing sale';
    end if;
    return existing_order;
  end if;

  completed_order := public.complete_pos_cash_sale(
    sale_order_number,
    sale_customer_id,
    sale_subtotal,
    sale_vat,
    sale_total,
    sale_staff_user_id,
    sale_staff_name,
    sale_staff_role,
    sale_items,
    sale_cash_received
  );

  update public.orders
  set offline_transaction_id = sale_offline_transaction_id,
      offline_device_id = sale_offline_device_id,
      offline_sync_status = 'SYNCED',
      offline_synced_at = timezone('utc', now()),
      offline_sync_error = null
  where id = completed_order.id
  returning * into completed_order;

  insert into public.pos_sync_records (
    transaction_id,
    device_id,
    staff_user_id,
    status,
    payload,
    order_id,
    synced_at
  ) values (
    sale_offline_transaction_id,
    sale_offline_device_id,
    sale_staff_user_id,
    'SYNCED',
    sale_payload,
    completed_order.id,
    timezone('utc', now())
  );

  return completed_order;
end;
$$;

revoke all on function public.complete_pos_offline_cash_sale(
  uuid, text, uuid, text, uuid, numeric, numeric, numeric, text, text, jsonb, numeric, jsonb
) from public, anon, authenticated;
grant execute on function public.complete_pos_offline_cash_sale(
  uuid, text, uuid, text, uuid, numeric, numeric, numeric, text, text, jsonb, numeric, jsonb
) to service_role;
