insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'brand-logos',
  'brand-logos',
  true,
  3145728,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

with logo_assets (slug, object_name) as (
  values
    ('abb', 'abb.jpg'),
    ('aicco', 'aicco.png'),
    ('andeli', 'andeli.png'),
    ('cable-connect', 'cable-connect.jpg'),
    ('canam', 'canam.jpeg'),
    ('chint', 'chint.png'),
    ('cigma', 'cigma.jpeg'),
    ('coslec', 'coslec.png'),
    ('dantown-electrical', 'dantown-electrical.png'),
    ('deye', 'deye.png'),
    ('east-africa-cable', 'east-africa-cable.png'),
    ('ensave', 'ensave.png'),
    ('fame', 'fame.png'),
    ('grass-cutter', 'grass-cutter.jpeg'),
    ('growatt', 'growatt.png'),
    ('hager', 'hager.png'),
    ('happy-home', 'happy-home.jpeg'),
    ('havells', 'havells.png'),
    ('hikvision', 'hikvision.jpg'),
    ('htg', 'htg.jpeg'),
    ('itel', 'itel.jpg'),
    ('jinko', 'jinko.png'),
    ('max', 'max.jpeg'),
    ('must', 'must.jpeg'),
    ('neelux', 'neelux.jpeg'),
    ('osram', 'osram.jpg'),
    ('panasonic', 'panasonic.jpg'),
    ('philips', 'philips.jpg'),
    ('powerflex', 'powerflex.png'),
    ('powermax', 'powermax.png'),
    ('pulsar', 'pulsar.jpeg'),
    ('rr', 'rr.png'),
    ('schneider-electric', 'schneider-electric.jpg'),
    ('solarmax', 'solarmax.png'),
    ('terminator', 'terminator.jpeg'),
    ('total', 'total.jpeg'),
    ('tronic', 'tronic.jpg'),
    ('vellmax', 'vellmax.png'),
    ('windsor', 'windsor.png')
)
update public.brands as brand
set logo_url = 'https://vldccdtuwwyumqdkyxde.supabase.co/storage/v1/object/public/brand-logos/'
  || logo_assets.object_name
from logo_assets
where brand.slug = logo_assets.slug
  and brand.is_active;