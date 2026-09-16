insert into public.inventory (product_id, warehouse_id, quantity, reserved_quantity, reorder_level, reorder_quantity)
select p.id, w.id, 0, 0, 5, 20 from public.products p cross join public.warehouses w where p.sku like 'DEMO-%'
on conflict (product_id, variant_id, warehouse_id, location_id) do nothing;
