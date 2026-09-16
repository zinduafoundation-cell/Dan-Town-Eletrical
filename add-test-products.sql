-- Add test category if not exists
INSERT INTO public.categories (name, slug, description, is_active) 
VALUES ('Electrical Supply', 'electrical-supply', 'Electrical supplies and equipment', true)
ON CONFLICT (slug) DO NOTHING;

-- Add test products
INSERT INTO public.products (
  sku, name, slug, description, category_id, cost_price, retail_price, 
  vat_rate, status, is_active, created_at
) 
SELECT 
  'CABLE-001' as sku,
  'Electrical Cable 2.5mm' as name,
  'electrical-cable-2-5mm' as slug,
  'High quality electrical cable for installations' as description,
  c.id as category_id,
  150.00 as cost_price,
  250.00 as retail_price,
  16 as vat_rate,
  'ACTIVE'::public.product_status as status,
  true as is_active,
  timezone('utc', now()) as created_at
FROM public.categories c
WHERE c.slug = 'electrical-supply'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (
  sku, name, slug, description, category_id, cost_price, retail_price, 
  vat_rate, status, is_active, created_at
) 
SELECT 
  'SOCKET-001' as sku,
  'Power Socket Outlet' as name,
  'power-socket-outlet' as slug,
  'Durable power socket outlet for residential use' as description,
  c.id as category_id,
  80.00 as cost_price,
  150.00 as retail_price,
  16 as vat_rate,
  'ACTIVE'::public.product_status as status,
  true as is_active,
  timezone('utc', now()) as created_at
FROM public.categories c
WHERE c.slug = 'electrical-supply'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (
  sku, name, slug, description, category_id, cost_price, retail_price, 
  vat_rate, status, is_active, created_at
) 
SELECT 
  'BULB-001' as sku,
  'LED Bulb 10W' as name,
  'led-bulb-10w' as slug,
  'Energy efficient LED bulb - 10W bright white' as description,
  c.id as category_id,
  120.00 as cost_price,
  200.00 as retail_price,
  16 as vat_rate,
  'ACTIVE'::public.product_status as status,
  true as is_active,
  timezone('utc', now()) as created_at
FROM public.categories c
WHERE c.slug = 'electrical-supply'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (
  sku, name, slug, description, category_id, cost_price, retail_price, 
  vat_rate, status, is_active, created_at
) 
SELECT 
  'SWITCH-001' as sku,
  'Light Switch - Single Gang' as name,
  'light-switch-single-gang' as slug,
  'Professional grade single gang light switch' as description,
  c.id as category_id,
  50.00 as cost_price,
  100.00 as retail_price,
  16 as vat_rate,
  'ACTIVE'::public.product_status as status,
  true as is_active,
  timezone('utc', now()) as created_at
FROM public.categories c
WHERE c.slug = 'electrical-supply'
ON CONFLICT (sku) DO NOTHING;

-- Add inventory for products (assuming warehouse_id exists)
INSERT INTO public.inventory (product_id, warehouse_id, quantity)
SELECT 
  p.id, 
  w.id,
  CASE 
    WHEN p.sku = 'CABLE-001' THEN 50
    WHEN p.sku = 'SOCKET-001' THEN 120
    WHEN p.sku = 'BULB-001' THEN 200
    WHEN p.sku = 'SWITCH-001' THEN 80
  END as quantity
FROM public.products p
CROSS JOIN (SELECT id FROM public.warehouses LIMIT 1) w
WHERE p.sku IN ('CABLE-001', 'SOCKET-001', 'BULB-001', 'SWITCH-001')
  AND p.is_active = true
ON CONFLICT (product_id, warehouse_id) DO UPDATE SET quantity = EXCLUDED.quantity;
