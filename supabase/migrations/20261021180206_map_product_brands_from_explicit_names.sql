insert into public.brands (name, slug, logo_url, is_active)
values
  ('Amayia', 'amayia', null, true),
  ('Andlight', 'andlight', null, true),
  ('Anshy', 'anshy', null, true),
  ('Dupro', 'dupro', null, true),
  ('Estia', 'estia', null, true),
  ('Greeny', 'greeny', null, true),
  ('HSW', 'hsw', null, true),
  ('Oramno', 'oramno', null, true),
  ('Powersafe', 'powersafe', null, true),
  ('Punex', 'punex', null, true),
  ('Samsung', 'samsung', null, true),
  ('Scanford', 'scanford', null, true),
  ('Wahl', 'wahl', null, true)
on conflict (slug) do update
set name = excluded.name,
    is_active = true;

with brand_patterns (slug, pattern) as (
  values
    ('amayia', '(^|[^[:alnum:]])Amayia([^[:alnum:]]|$)'),
    ('andlight', '(^|[^[:alnum:]])Andlight([^[:alnum:]]|$)'),
    ('anshy', '(^|[^[:alnum:]])Anshy([^[:alnum:]]|$)'),
    ('dupro', '(^|[^[:alnum:]])Dupro([^[:alnum:]]|$)'),
    ('estia', '(^|[^[:alnum:]])Estia([^[:alnum:]]|$)'),
    ('greeny', '(^|[^[:alnum:]])Greeny([^[:alnum:]]|$)'),
    ('hsw', '(^|[^[:alnum:]])HSW([^[:alnum:]]|$)'),
    ('oramno', '(^|[^[:alnum:]])Oramno([^[:alnum:]]|$)'),
    ('powersafe', '(^|[^[:alnum:]])Powersafe([^[:alnum:]]|$)'),
    ('punex', '(^|[^[:alnum:]])Punex([^[:alnum:]]|$)'),
    ('samsung', '(^|[^[:alnum:]])Samsung([^[:alnum:]]|$)'),
    ('scanford', '(^|[^[:alnum:]])Scanford([^[:alnum:]]|$)'),
    ('wahl', '(^|[^[:alnum:]])Wahl([^[:alnum:]]|$)')
),
explicit_product_matches as (
  select
    product.id as product_id,
    brand.id as brand_id,
    count(*) over (partition by product.id) as match_count
  from public.products as product
  join brand_patterns as pattern
    on product.name ~* pattern.pattern
  join public.brands as brand
    on brand.slug = pattern.slug
   and brand.is_active
  where product.is_active
    and product.status = 'ACTIVE'
    and product.brand_id is null
)
update public.products as product
set brand_id = matches.brand_id
from explicit_product_matches as matches
where product.id = matches.product_id
  and matches.match_count = 1;