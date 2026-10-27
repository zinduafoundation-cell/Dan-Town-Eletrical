create or replace function public.initialize_catalog_product_stock(
  target_product_id uuid,
  target_warehouse_id uuid,
  target_quantity integer,
  target_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  product_record public.products;
  warehouse_record public.warehouses;
  inventory_record public.inventory;
begin
  if target_quantity < 0 or target_quantity > 100000 then
    raise exception 'Initial stock must be between 0 and 100000';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_product_id::text || target_warehouse_id::text, 0)
  );

  select * into product_record
  from public.products
  where id = target_product_id
  for update;
  if not found then
    raise exception 'Product does not exist';
  end if;

  select * into warehouse_record
  from public.warehouses
  where id = target_warehouse_id
    and is_active = true;
  if not found then
    raise exception 'Choose an active warehouse';
  end if;

  select * into inventory_record
  from public.inventory
  where product_id = target_product_id
    and warehouse_id = target_warehouse_id
    and variant_id is null
    and location_id is null
  order by created_at, id
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'initialized', false,
      'inventory_id', inventory_record.id,
      'quantity', inventory_record.quantity
    );
  end if;

  insert into public.inventory (
    product_id, warehouse_id, quantity, reserved_quantity
  )
  values (
    target_product_id, target_warehouse_id, target_quantity, 0
  )
  returning * into inventory_record;

  if target_quantity > 0 then
    insert into public.inventory_movements (
      product_id, warehouse_id, quantity, movement_type, reference_type,
      reference_id, previous_quantity, new_quantity, created_by
    )
    values (
      target_product_id, target_warehouse_id, target_quantity, 'ADJUSTMENT',
      'INITIAL_PRODUCT_STOCK', inventory_record.id, 0, target_quantity,
      target_user_id
    );
  end if;

  insert into public.audit_logs (
    user_id, action, resource_type, resource_id, new_data
  )
  values (
    target_user_id,
    'INITIAL_PRODUCT_STOCK_SET',
    'inventory',
    inventory_record.id,
    jsonb_build_object(
      'product_id', target_product_id,
      'warehouse_id', target_warehouse_id,
      'quantity', target_quantity,
      'reference_type', 'INITIAL_PRODUCT_STOCK'
    )
  );

  return jsonb_build_object(
    'initialized', true,
    'inventory_id', inventory_record.id,
    'quantity', inventory_record.quantity
  );
end;
$$;

revoke all on function public.initialize_catalog_product_stock(uuid, uuid, integer, uuid) from public;
grant execute on function public.initialize_catalog_product_stock(uuid, uuid, integer, uuid) to service_role;