begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(7);

create temporary table catalog_initial_stock_test_state (
  product_id uuid,
  warehouse_id uuid,
  user_id uuid
) on commit drop;

do $$
declare
  product_id uuid;
  warehouse_id uuid;
  user_id uuid;
begin
  insert into public.warehouses (name, code)
  values ('Initial stock test warehouse', 'IST-' || substr(gen_random_uuid()::text, 1, 8))
  returning id into warehouse_id;

  insert into public.products (sku, name, slug, retail_price, status, is_active)
  values (
    'IST-' || substr(gen_random_uuid()::text, 1, 8),
    'Initial stock test item',
    'initial-stock-' || gen_random_uuid()::text,
    100,
    'ACTIVE',
    true
  )
  returning id into product_id;

  insert into catalog_initial_stock_test_state (product_id, warehouse_id)
  values (product_id, warehouse_id);
end;
$$;

select extensions.is(
  (public.initialize_catalog_product_stock(
    (select product_id from catalog_initial_stock_test_state),
    (select warehouse_id from catalog_initial_stock_test_state),
    50,
    null
  )->>'quantity')::integer,
  50,
  'new products receive the requested initial quantity'
);

select extensions.is(
  (
    select count(*)::integer
    from public.inventory_movements
    where product_id = (select product_id from catalog_initial_stock_test_state)
      and reference_type = 'INITIAL_PRODUCT_STOCK'
  ),
  1,
  'initial stock is recorded once in the stock movement ledger'
);

select extensions.lives_ok(
  $$
    select public.complete_pos_sale(
      'IST-SALE-' || gen_random_uuid()::text,
      null,
      100,
      16,
      116,
      'CASH',
      null,
      'Initial stock test',
      'ADMIN',
      jsonb_build_array(jsonb_build_object(
        'product_id',
        (select product_id from catalog_initial_stock_test_state),
        'quantity',
        1
      ))
    )
  $$,
  'a POS sale can consume the initialized inventory'
);

select extensions.is(
  (
    select quantity
    from public.inventory
    where product_id = (select product_id from catalog_initial_stock_test_state)
      and warehouse_id = (select warehouse_id from catalog_initial_stock_test_state)
      and variant_id is null
      and location_id is null
  ),
  49,
  'POS sales reduce the on-hand balance'
);

select extensions.is(
  (public.initialize_catalog_product_stock(
    (select product_id from catalog_initial_stock_test_state),
    (select warehouse_id from catalog_initial_stock_test_state),
    50,
    null
  )->>'quantity')::integer,
  49,
  're-running initialization does not reset stock after a sale or adjustment'
);

select extensions.is(
  (
    select count(*)::integer
    from public.inventory_movements
    where product_id = (select product_id from catalog_initial_stock_test_state)
      and reference_type = 'INITIAL_PRODUCT_STOCK'
  ),
  1,
  'retries do not create duplicate opening movements'
);

select extensions.throws_ok(
  $$select public.initialize_catalog_product_stock(
      (select product_id from catalog_initial_stock_test_state),
      (select warehouse_id from catalog_initial_stock_test_state),
      -1,
      null
    )$$,
  'P0001',
  'Initial stock must be between 0 and 100000',
  'negative initial quantities are rejected'
);

select * from extensions.finish();
rollback;
