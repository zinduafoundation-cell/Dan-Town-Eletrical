-- Extend the authoritative POS order record with durable offline sync identity.
alter table public.orders
  add column if not exists offline_transaction_id uuid unique,
  add column if not exists offline_device_id text,
  add column if not exists offline_sync_status text check (offline_sync_status in ('PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'CONFLICT')),
  add column if not exists offline_retry_count integer not null default 0 check (offline_retry_count >= 0),
  add column if not exists offline_sync_error text,
  add column if not exists offline_synced_at timestamptz;

create table if not exists public.pos_sync_records (
  transaction_id uuid primary key,
  device_id text not null,
  staff_user_id uuid references auth.users(id) on delete set null,
  status text not null check (status in ('PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'CONFLICT')),
  payload jsonb not null,
  order_id uuid references public.orders(id) on delete set null,
  retry_count integer not null default 0 check (retry_count >= 0),
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  synced_at timestamptz
);

create index if not exists orders_offline_sync_status_idx on public.orders(offline_sync_status) where offline_sync_status is not null;
create index if not exists orders_offline_device_idx on public.orders(offline_device_id, created_at desc) where offline_device_id is not null;
create index if not exists pos_sync_status_idx on public.pos_sync_records(status, created_at desc);
create index if not exists pos_sync_device_idx on public.pos_sync_records(device_id, created_at desc);

alter table public.pos_sync_records enable row level security;
drop policy if exists "authorized staff read POS sync records" on public.pos_sync_records;
create policy "authorized staff read POS sync records" on public.pos_sync_records for select using (public.has_permission('orders.read'));