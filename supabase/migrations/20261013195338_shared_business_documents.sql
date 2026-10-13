create table if not exists public.business_document_settings (
  id text primary key default 'dantown' check (id = 'dantown'),
  template jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.business_document_settings enable row level security;

revoke all on table public.business_document_settings from public, anon, authenticated;
grant select, insert, update on table public.business_document_settings to service_role;

create index if not exists payments_created_at_id_idx
  on public.payments (created_at desc, id desc);

create index if not exists payments_status_created_at_id_idx
  on public.payments (status, created_at desc, id desc);

create index if not exists payments_method_created_at_id_idx
  on public.payments (method, created_at desc, id desc);

create index if not exists payments_order_status_created_at_idx
  on public.payments (order_id, status, created_at desc);

create index if not exists payments_provider_created_at_id_idx
  on public.payments (provider, created_at desc, id desc)
  where provider is not null;

create index if not exists payment_transactions_payment_created_at_idx
  on public.payment_transactions (payment_id, created_at desc);