create unique index if not exists inventory_purchase_receiving_reference_unique
on public.inventory_movements (reference_id)
where reference_type = 'PURCHASE_RECEIVING' and reference_id is not null;

drop policy if exists "authorized staff manage purchase order items" on public.purchase_order_items;
create policy "authorized staff manage purchase order items" on public.purchase_order_items
for all using (public.has_permission('inventory.adjust'))
with check (public.has_permission('inventory.adjust'));

drop policy if exists "authorized staff create audit logs" on public.audit_logs;
create policy "authorized staff create audit logs" on public.audit_logs
for insert with check (public.has_permission('inventory.adjust'));

create or replace function public.receive_purchase_order_item(
  target_purchase_order_id uuid,
  target_item_id uuid,
  target_received_quantity integer,
  target_reference_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_order public.purchase_orders;
  target_item public.purchase_order_items;
  target_inventory public.inventory;
  next_status public.purchase_order_status;
  total_received integer;
begin
  if not public.has_permission('inventory.adjust') then
    raise exception 'Not authorized to receive inventory';
  end if;
  if target_received_quantity <= 0 or target_reference_id is null then
    raise exception 'A positive quantity and unique receiving reference are required';
  end if;
  if exists (
    select 1 from public.inventory_movements
    where reference_type = 'PURCHASE_RECEIVING' and reference_id = target_reference_id
  ) then
    raise exception 'This receiving reference has already been processed';
  end if;

  select * into target_order from public.purchase_orders
  where id = target_purchase_order_id for update;
  if not found then raise exception 'Purchase order does not exist'; end if;
  if target_order.status not in ('APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED') then
    raise exception 'Purchase order is not ready for receiving';
  end if;

  select * into target_item from public.purchase_order_items
  where id = target_item_id and purchase_order_id = target_purchase_order_id for update;
  if not found then raise exception 'Purchase order item does not exist'; end if;
  if target_item.received_quantity + target_received_quantity > target_item.quantity then
    raise exception 'Receiving quantity exceeds the outstanding purchase quantity';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_item.product_id::text || target_order.warehouse_id::text, 0));
  select * into target_inventory from public.inventory
  where product_id = target_item.product_id and warehouse_id = target_order.warehouse_id
    and variant_id is null and location_id is null for update;
  if not found then
    insert into public.inventory (product_id, warehouse_id, quantity)
    values (target_item.product_id, target_order.warehouse_id, target_received_quantity)
    returning * into target_inventory;
  else
    update public.inventory
    set quantity = quantity + target_received_quantity
    where id = target_inventory.id
    returning * into target_inventory;
  end if;

  update public.purchase_order_items
  set received_quantity = received_quantity + target_received_quantity
  where id = target_item.id;

  select coalesce(sum(received_quantity), 0) into total_received
  from public.purchase_order_items where purchase_order_id = target_order.id;
  next_status := case when total_received = (select sum(quantity) from public.purchase_order_items where purchase_order_id = target_order.id)
    then 'RECEIVED'::public.purchase_order_status else 'PARTIALLY_RECEIVED'::public.purchase_order_status end;
  update public.purchase_orders set status = next_status where id = target_order.id;

  insert into public.inventory_movements
    (product_id, warehouse_id, quantity, movement_type, reference_type, reference_id, previous_quantity, new_quantity, created_by)
  values
    (target_item.product_id, target_order.warehouse_id, target_received_quantity, 'PURCHASE', 'PURCHASE_RECEIVING', target_reference_id,
      target_inventory.quantity - target_received_quantity, target_inventory.quantity, auth.uid());
  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data)
  values (auth.uid(), 'PURCHASE_RECEIVED', 'purchase_order', target_order.id,
    jsonb_build_object('item_id', target_item.id, 'quantity', target_received_quantity, 'reference_id', target_reference_id));

  return jsonb_build_object('purchase_order_id', target_order.id, 'item_id', target_item.id,
    'inventory_id', target_inventory.id, 'received_quantity', target_item.received_quantity + target_received_quantity,
    'status', next_status);
end;
$$;

revoke all on function public.receive_purchase_order_item(uuid, uuid, integer, uuid) from public;
grant execute on function public.receive_purchase_order_item(uuid, uuid, integer, uuid) to authenticated;