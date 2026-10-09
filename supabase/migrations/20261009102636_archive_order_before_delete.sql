create or replace function public.capture_deleted_order()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_action text;
  v_actor_user_id uuid;
  v_metadata jsonb;
  v_archive jsonb;
begin
  v_action := coalesce(
    nullif(pg_catalog.current_setting('dantown.order_archive_action', true), ''),
    'ORDER_DELETED_BY_ADMIN'
  );
  if v_action not in ('ORDER_DELETED', 'ORDER_DELETED_BY_ADMIN', 'ORDER_AUTO_DELETED') then
    raise exception 'Unsupported order archive action';
  end if;

  v_actor_user_id := coalesce(
    nullif(pg_catalog.current_setting('dantown.order_archive_actor', true), '')::uuid,
    auth.uid()
  );
  v_metadata := coalesce(
    nullif(pg_catalog.current_setting('dantown.order_archive_metadata', true), '')::jsonb,
    '{}'::jsonb
  );
  if pg_catalog.jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'Order archive metadata must be a JSON object';
  end if;

  v_archive := pg_catalog.jsonb_build_object(
    'order_number', old.order_number,
    'total', old.total,
    'sales_channel', old.sales_channel,
    'order_snapshot', pg_catalog.jsonb_build_object(
      'id', old.id,
      'order_number', old.order_number,
      'customer_id', old.customer_id,
      'subtotal', old.subtotal,
      'discount', old.discount,
      'vat', old.vat,
      'delivery_fee', old.delivery_fee,
      'total', old.total,
      'payment_status', old.payment_status,
      'order_status', old.order_status,
      'sales_channel', old.sales_channel,
      'created_by', old.created_by,
      'created_at', old.created_at,
      'updated_at', old.updated_at
    ),
    'items_snapshot', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) order by item.id)
      from public.order_items item
      where item.order_id = old.id
    ), '[]'::jsonb),
    'status_history_snapshot', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(history) order by history.created_at, history.id)
      from public.order_status_history history
      where history.order_id = old.id
    ), '[]'::jsonb),
    'deleted_at', pg_catalog.clock_timestamp(),
    'deleted_by_role', 'database',
    'reason', 'direct_database_delete'
  ) || v_metadata;

  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data)
  values (v_actor_user_id, v_action, 'order', old.id, v_archive);

  perform pg_catalog.set_config('dantown.order_archive_action', '', true);
  perform pg_catalog.set_config('dantown.order_archive_actor', '', true);
  perform pg_catalog.set_config('dantown.order_archive_metadata', '', true);

  return old;
end;
$$;

revoke all on function public.capture_deleted_order() from public;
revoke all on function public.capture_deleted_order() from anon, authenticated, service_role;

drop trigger if exists archive_order_before_delete on public.orders;
create trigger archive_order_before_delete
before delete on public.orders
for each row execute function public.capture_deleted_order();

create or replace function public.archive_and_delete_order(
  p_order_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_locked_order_id uuid;
begin
  if p_action not in ('ORDER_DELETED', 'ORDER_DELETED_BY_ADMIN', 'ORDER_AUTO_DELETED') then
    raise exception 'Unsupported order archive action';
  end if;

  if p_metadata is null or pg_catalog.jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Order archive metadata must be a JSON object';
  end if;

  select id into v_locked_order_id
  from public.orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'Order not found';
  end if;

  perform pg_catalog.set_config('dantown.order_archive_action', p_action, true);
  perform pg_catalog.set_config('dantown.order_archive_actor', coalesce(p_actor_user_id::text, ''), true);
  perform pg_catalog.set_config('dantown.order_archive_metadata', p_metadata::text, true);

  delete from public.orders where id = p_order_id;
end;
$$;

revoke all on function public.archive_and_delete_order(uuid, uuid, text, jsonb) from public;
revoke all on function public.archive_and_delete_order(uuid, uuid, text, jsonb) from anon, authenticated;
grant execute on function public.archive_and_delete_order(uuid, uuid, text, jsonb) to service_role;
