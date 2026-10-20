insert into public.brands (name, slug, logo_url, is_active)
values
  ('ABB', 'abb', '/images/brands/Abb.jpg', true),
  ('Aicco', 'aicco', '/images/brands/solar/Aicco.png', true),
  ('Andeli', 'andeli', '/images/brands/Andeli.png', true),
  ('Cable Connect', 'cable-connect', '/images/brands/Cable connect.jpg', true),
  ('Canam', 'canam', '/images/brands/Canam.jpeg', true),
  ('Chint', 'chint', '/images/brands/Chint.png', true),
  ('Cigma', 'cigma', '/images/brands/Cigma.jpeg', true),
  ('Coslec', 'coslec', '/images/brands/Coslec.png', true),
  ('Dantown Electrical', 'dantown-electrical', '/images/brands/logo dantown.png', true),
  ('Deye', 'deye', '/images/brands/solar/Deye.png', true),
  ('East Africa Cable', 'east-africa-cable', '/images/brands/East africa cable.png', true),
  ('Ensave', 'ensave', '/images/brands/Ensave.png', true),
  ('Fame', 'fame', '/images/brands/Fame.png', true),
  ('Grass Cutter', 'grass-cutter', '/images/brands/Grass cutter.jpeg', true),
  ('Growatt', 'growatt', '/images/brands/solar/Growatt.png', true),
  ('Hager', 'hager', '/images/brands/Hager.png', true),
  ('Happy Home', 'happy-home', '/images/brands/Happy home.jpeg', true),
  ('Havells', 'havells', '/images/brands/Havells.png', true),
  ('Hikvision', 'hikvision', '/images/brands/Hikvision.jpg', true),
  ('HTG', 'htg', '/images/brands/Htg.jpeg', true),
  ('Itel', 'itel', '/images/brands/itel.jpg', true),
  ('Jinko', 'jinko', '/images/brands/solar/Jinko.png', true),
  ('MAX', 'max', '/images/brands/Max.jpeg', true),
  ('Must', 'must', '/images/brands/solar/Must.jpeg', true),
  ('Neelux', 'neelux', '/images/brands/Neelux.jpeg', true),
  ('Osram', 'osram', '/images/brands/osram.jpg', true),
  ('Panasonic', 'panasonic', '/images/brands/panasonic.jpg', true),
  ('Philips', 'philips', '/images/brands/philips.jpg', true),
  ('PowerFlex', 'powerflex', '/images/brands/Powerflex.png', true),
  ('Powermax', 'powermax', '/images/brands/Powermax.png', true),
  ('Pulsar', 'pulsar', '/images/brands/Pulsar.jpeg', true),
  ('RR', 'rr', '/images/brands/Rr.png', true),
  ('Schneider Electric', 'schneider-electric', '/images/brands/schneider.jpg', true),
  ('Solarmax', 'solarmax', '/images/brands/solar/Solarmax.png', true),
  ('Terminator', 'terminator', '/images/brands/Terminator.jpeg', true),
  ('Total', 'total', '/images/brands/TOtal.jpeg', true),
  ('Tronic', 'tronic', '/images/brands/tronic.jpg', true),
  ('Vellmax', 'vellmax', '/images/brands/Vellmax.png', true),
  ('Windsor', 'windsor', '/images/brands/Windsor.png', true)
on conflict (slug) do update
set name = excluded.name,
    logo_url = excluded.logo_url,
    is_active = true;

with brand_patterns (slug, pattern) as (
  values
    ('abb', '(^|[^[:alnum:]])ABB([^[:alnum:]]|$)'),
    ('aicco', '(^|[^[:alnum:]])Aicco([^[:alnum:]]|$)'),
    ('andeli', '(^|[^[:alnum:]])Andeli([^[:alnum:]]|$)'),
    ('cable-connect', '(^|[^[:alnum:]])Cable[[:space:]]+Connect([^[:alnum:]]|$)'),
    ('canam', '(^|[^[:alnum:]])Canam([^[:alnum:]]|$)'),
    ('chint', '(^|[^[:alnum:]])Chint([^[:alnum:]]|$)'),
    ('cigma', '(^|[^[:alnum:]])Cigma([^[:alnum:]]|$)'),
    ('coslec', '(^|[^[:alnum:]])Coslec([^[:alnum:]]|$)'),
    ('deye', '(^|[^[:alnum:]])Deye([^[:alnum:]]|$)'),
    ('east-africa-cable', '(^|[^[:alnum:]])East[[:space:]]+Africa[[:space:]]+Cable([^[:alnum:]]|$)'),
    ('ensave', '(^|[^[:alnum:]])Ensave([^[:alnum:]]|$)'),
    ('fame', '(^|[^[:alnum:]])Fame([^[:alnum:]]|$)'),
    ('grass-cutter', '(^|[^[:alnum:]])Grass[[:space:]]+Cutter([^[:alnum:]]|$)'),
    ('growatt', '(^|[^[:alnum:]])Growatt([^[:alnum:]]|$)'),
    ('hager', '(^|[^[:alnum:]])Hager([^[:alnum:]]|$)'),
    ('happy-home', '(^|[^[:alnum:]])Happy[[:space:]]+Home([^[:alnum:]]|$)'),
    ('havells', '(^|[^[:alnum:]])Havells([^[:alnum:]]|$)'),
    ('hikvision', '(^|[^[:alnum:]])Hikvision([^[:alnum:]]|$)'),
    ('htg', '(^|[^[:alnum:]])HTG([^[:alnum:]]|$)'),
    ('itel', '(^|[^[:alnum:]])itel([^[:alnum:]]|$)'),
    ('jinko', '(^|[^[:alnum:]])Jinko([^[:alnum:]]|$)'),
    ('max', '(^|[^[:alnum:]])MAX([^[:alnum:]]|$)'),
    ('must', '(^|[^[:alnum:]])Must([^[:alnum:]]|$)'),
    ('neelux', '(^|[^[:alnum:]])Neelux([^[:alnum:]]|$)'),
    ('osram', '(^|[^[:alnum:]])Osram([^[:alnum:]]|$)'),
    ('panasonic', '(^|[^[:alnum:]])Panasonic([^[:alnum:]]|$)'),
    ('philips', '(^|[^[:alnum:]])Philips([^[:alnum:]]|$)'),
    ('powerflex', '(^|[^[:alnum:]])PowerFlex([^[:alnum:]]|$)'),
    ('powermax', '(^|[^[:alnum:]])Powermax([^[:alnum:]]|$)'),
    ('pulsar', '(^|[^[:alnum:]])Pulsar([^[:alnum:]]|$)'),
    ('rr', '(^|[^[:alnum:]])RR([^[:alnum:]]|$)'),
    ('schneider-electric', '(^|[^[:alnum:]])Schneider([[:space:]]+Electric)?([^[:alnum:]]|$)'),
    ('solarmax', '(^|[^[:alnum:]])Solar[[:space:]]*Max([^[:alnum:]]|$)'),
    ('terminator', '(^|[^[:alnum:]])Terminator([^[:alnum:]]|$)'),
    ('total', '(^|[^[:alnum:]])Total([^[:alnum:]]|$)'),
    ('tronic', '(^|[^[:alnum:]])Tronic([^[:alnum:]]|$)'),
    ('vellmax', '(^|[^[:alnum:]])Vellmax([^[:alnum:]]|$)'),
    ('windsor', '(^|[^[:alnum:]])Windsor([^[:alnum:]]|$)')
),
explicit_product_matches as (
  select p.id as product_id, b.id as brand_id,
    count(*) over (partition by p.id) as match_count
  from public.products p
  left join public.brands current_brand on current_brand.id = p.brand_id
  join brand_patterns pattern on concat_ws(' ', p.name, p.sku::text) ~* pattern.pattern
  join public.brands b on b.slug = pattern.slug
  where p.brand_id is null or current_brand.slug = 'dantown-electrical'
)
update public.products p
set brand_id = matches.brand_id
from explicit_product_matches matches
where matches.product_id = p.id
  and matches.match_count = 1;