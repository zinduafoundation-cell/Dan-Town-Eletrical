alter table public.orders
  add column if not exists delivery_method text,
  add column if not exists delivery_carrier text,
  add column if not exists delivery_tracking_reference text,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivery_proof_path text,
  add column if not exists delivery_confirmed_at timestamptz,
  add column if not exists delivery_confirmed_by uuid references auth.users(id) on delete set null;

create index if not exists orders_delivery_tracking_reference_idx
  on public.orders (delivery_tracking_reference)
  where delivery_tracking_reference is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'delivery-proofs',
  'delivery-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';