begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(7);

create temporary table order_fulfillment_test_state (
  product_id uuid,
  split_product_id uuid,
  warehouse_a uuid,
  warehouse_b uuid,
  order_id uuid
) on commit drop;

do $$
declare
  product_id uuid;
  split_product_id uuid;
  warehouse_a uuid;
  warehouse_b uuid;
begin
  insert into public.warehouses (name, code)
  values ('Fulfillment test A', 'TST-' || substr(gen_random_uuid()::text, 1, 8))
  returning id into warehouse_a;

  insert into public.warehouses (name, code)
  values ('Fulfillment test B', 'TST-' || substr(gen_random_uuid()::text, 1, 8))
  returning id into warehouse_b;

  insert into public.products (sku, name, slug, retail_price, status, is_active)
  values (
    'TST-' || substr(gen_random_uuid()::text, 1, 8),
    'Single-location item',
    'test-' || gen_random_uuid()::text,
    100,
    'ACTIVE',
    true
  )
  returning id into product_id;

  insert into public.products (sku, name, slug, retail_price, status, is_active)
  values (
    'TST-' || substr(gen_random_uuid()::text, 1, 8),
    'Split item',
    'test-' || gen_random_uuid()::text,
    100,
    'ACTIVE',
    true
  )
  returning id into split_product_id;

  insert into public.inventory (product_id, warehouse_id, quantity, reserved_quantity)
  values
    (product_id, warehouse_a, 5, 3),
    (product_id, warehouse_b, 10, 9),
    (split_product_id, warehouse_a, 1, 0),
    (split_product_id, warehouse_b, 1, 0);

  insert into order_fulfillment_test_state (product_id, split_product_id, warehouse_a, warehouse_b)
  values (product_id, split_product_id, warehouse_a, warehouse_b);
end;
$$;

select extensions.ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_items'
      and column_name = 'source_warehouse_id'
  ),
  'order items persist a source warehouse'
);

select extensions.ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.order_items'::regclass
      and confrelid = 'public.warehouses'::regclass
      and contype = 'f'
  ),
  'the source warehouse is protected by a foreign key'
);

select extensions.lives_ok(
  $$
    do $order$
    declare
      created_order public.orders;
      state order_fulfillment_test_state%rowtype;
    begin
      select * into state from order_fulfillment_test_state;
      select * into created_order
      from public.create_online_order(
        'TST-' || gen_random_uuid()::text,
        null,
        'Test customer',
        'test-' || gen_random_uuid()::text,
        null,
        'pickup',
        null,
        0,
        jsonb_build_array(jsonb_build_object('product_id', state.product_id, 'quantity', 2))
      );
      update order_fulfillment_test_state set order_id = created_order.id;
    end
    $order$;
  $$,
  'a customer order reserves stock successfully'
);

select extensions.is(
  (
    select source_warehouse_id::text
    from public.order_items
    where order_id = (select order_id from order_fulfillment_test_state)
  ),
  (select warehouse_a::text from order_fulfillment_test_state),
  'the exact checked warehouse is saved on the order item'
);

select extensions.is(
  (
    select reserved_quantity
    from public.inventory
    where product_id = (select product_id from order_fulfillment_test_state)
      and warehouse_id = (select warehouse_a from order_fulfillment_test_state)
  ),
  5,
  'the selected warehouse reservation is updated atomically'
);

select extensions.throws_ok(
  $$
    select public.create_online_order(
      'TST-' || gen_random_uuid()::text,
      null,
      'Split stock customer',
      'test-' || gen_random_uuid()::text,
      null,
      'pickup',
      null,
      0,
      jsonb_build_array(jsonb_build_object(
        'product_id',
        (select split_product_id from order_fulfillment_test_state),
        'quantity',
        2
      ))
    )
  $$,
  'P0001',
  'Insufficient stock at any single active warehouse for Split item',
  'an order is not reserved across warehouses without an explicit transfer'
);

select extensions.is(
  (
    select sum(reserved_quantity)::integer
    from public.inventory
    where product_id = (select split_product_id from order_fulfillment_test_state)
  ),
  0,
  'a rejected split-stock order leaves all stock reservations unchanged'
);

select * from extensions.finish();
rollback;
