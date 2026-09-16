create unique index if not exists inventory_transfer_reference_unique
on public.inventory_movements (reference_id)
where reference_type = 'WAREHOUSE_TRANSFER' and reference_id is not null;

drop policy if exists "authorized staff manage stock transfers" on public.stock_transfers;
create policy "authorized staff manage stock transfers" on public.stock_transfers
for all using (public.has_permission('inventory.adjust'))
with check (public.has_permission('inventory.adjust'));

drop policy if exists "authorized staff manage stock transfer items" on public.stock_transfer_items;
create policy "authorized staff manage stock transfer items" on public.stock_transfer_items
for all using (public.has_permission('inventory.adjust'))
with check (public.has_permission('inventory.adjust'));

create or replace function public.transfer_inventory(
  target_product_id uuid,
  target_source_warehouse_id uuid,
  target_destination_warehouse_id uuid,
  target_quantity integer,
  target_reference_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_inventory public.inventory;
  destination_inventory public.inventory;
  transfer_id uuid;
  source_previous integer;
  destination_previous integer;
begin
  if not public.has_permission('inventory.adjust') then
    raise exception 'Not authorized to transfer inventory';
  end if;
  if target_quantity <= 0 or target_reference_id is null then
    raise exception 'A positive quantity and unique transfer reference are required';
  end if;
  if target_source_warehouse_id = target_destination_warehouse_id then
    raise exception 'Source and destination warehouses must be different';
  end if;
  if exists (select 1 from public.inventory_movements where reference_type = 'WAREHOUSE_TRANSFER' and reference_id = target_reference_id) then
    raise exception 'This transfer reference has already been processed';
  end if;
  if not exists (select 1 from public.warehouses where id = target_source_warehouse_id and is_active)
    or not exists (select 1 from public.warehouses where id = target_destination_warehouse_id and is_active) then
    raise exception 'Source and destination warehouses must be active';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_product_id::text || least(target_source_warehouse_id::text, target_destination_warehouse_id::text) || greatest(target_source_warehouse_id::text, target_destination_warehouse_id::text), 0));
  select * into source_inventory from public.inventory
  where product_id = target_product_id and warehouse_id = target_source_warehouse_id and variant_id is null and location_id is null for update;
  if not found then raise exception 'Source inventory record does not exist'; end if;
  if source_inventory.quantity - source_inventory.reserved_quantity < target_quantity then
    raise exception 'Insufficient available inventory at source warehouse';
  end if;

  select * into destination_inventory from public.inventory
  where product_id = target_product_id and warehouse_id = target_destination_warehouse_id and variant_id is null and location_id is null for update;
  source_previous := source_inventory.quantity;
  if not found then
    insert into public.inventory (product_id, warehouse_id, quantity)
    values (target_product_id, target_destination_warehouse_id, target_quantity)
    returning * into destination_inventory;
    destination_previous := 0;
  else
    destination_previous := destination_inventory.quantity;
    update public.inventory set quantity = quantity + target_quantity where id = destination_inventory.id returning * into destination_inventory;
  end if;
  update public.inventory set quantity = quantity - target_quantity where id = source_inventory.id returning * into source_inventory;

  transfer_id := target_reference_id;
  insert into public.stock_transfers (id, from_warehouse_id, to_warehouse_id, status, created_by, received_by)
  values (transfer_id, target_source_warehouse_id, target_destination_warehouse_id, 'RECEIVED', auth.uid(), auth.uid());
  insert into public.stock_transfer_items (transfer_id, product_id, quantity)
  values (transfer_id, target_product_id, target_quantity);
  insert into public.inventory_movements (product_id, warehouse_id, quantity, movement_type, reference_type, reference_id, previous_quantity, new_quantity, created_by)
  values (target_product_id, target_source_warehouse_id, -target_quantity, 'TRANSFER_OUT', 'WAREHOUSE_TRANSFER', transfer_id, source_previous, source_inventory.quantity, auth.uid()),
    (target_product_id, target_destination_warehouse_id, target_quantity, 'TRANSFER_IN', 'WAREHOUSE_TRANSFER', transfer_id, destination_previous, destination_inventory.quantity, auth.uid());
  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data)
  values (auth.uid(), 'WAREHOUSE_TRANSFERRED', 'stock_transfer', transfer_id,
    jsonb_build_object('product_id', target_product_id, 'from_warehouse_id', target_source_warehouse_id, 'to_warehouse_id', target_destination_warehouse_id, 'quantity', target_quantity));

  return jsonb_build_object('transfer_id', transfer_id, 'product_id', target_product_id, 'quantity', target_quantity, 'status', 'RECEIVED');
end;
$$;

revoke all on function public.transfer_inventory(uuid, uuid, uuid, integer, uuid) from public;
grant execute on function public.transfer_inventory(uuid, uuid, uuid, integer, uuid) to authenticated;