insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public product images are readable" on storage.objects;
create policy "Public product images are readable"
on storage.objects for select
to public
using (bucket_id = 'product-images');

drop policy if exists "Authorized staff upload product images" on storage.objects;
create policy "Authorized staff upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.has_permission('products.update'));

drop policy if exists "Authorized staff update product images" on storage.objects;
create policy "Authorized staff update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.has_permission('products.update'))
with check (bucket_id = 'product-images' and public.has_permission('products.update'));
