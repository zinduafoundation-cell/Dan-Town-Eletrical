do $$ begin
  create type public.quotation_status as enum ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED');
exception when duplicate_object then null;
end $$;
create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(), quote_number text not null unique, customer_id uuid references public.customers(id) on delete set null, status public.quotation_status not null default 'DRAFT', subtotal numeric(12,2) not null default 0, discount numeric(12,2) not null default 0, vat numeric(12,2) not null default 0, delivery_fee numeric(12,2) not null default 0, total numeric(12,2) not null default 0, valid_until date, terms text, notes text, converted_order_id uuid references public.orders(id) on delete set null, created_by uuid references auth.users(id), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(), quotation_id uuid not null references public.quotations(id) on delete cascade, product_id uuid references public.products(id) on delete set null, product_name_snapshot text not null, sku_snapshot text not null, quantity integer not null check (quantity > 0), unit_price numeric(12,2) not null, discount numeric(12,2) not null default 0, vat numeric(12,2) not null default 0, line_total numeric(12,2) not null
);
create table if not exists public.quotation_versions (
  id uuid primary key default gen_random_uuid(), quotation_id uuid not null references public.quotations(id) on delete cascade, version_number integer not null, snapshot jsonb not null, created_by uuid references auth.users(id), created_at timestamptz not null default timezone('utc', now()), unique (quotation_id, version_number)
);
-- Trigger will be added below
-- Trigger will be added below
create trigger quotations_updated_at before update on public.quotations for each row execute function public.set_updated_at(); create index quotations_customer_idx on public.quotations(customer_id); create index quotations_status_idx on public.quotations(status);
alter table public.quotations enable row level security; alter table public.quotation_items enable row level security; alter table public.quotation_versions enable row level security;
drop policy if exists "customers read own quotations" on public.quotations;
drop policy if exists "customers read own quotations" on public.quotations;
create policy "customers read own quotations" on public.quotations for select using (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid()) or public.has_permission('quotes.read')); drop policy if exists "authorized staff manage quotations" on public.quotations;
drop policy if exists "authorized staff manage quotations" on public.quotations;
create policy "authorized staff manage quotations" on public.quotations for all using (public.has_permission('quotes.create') or public.has_permission('quotes.update')) with check (public.has_permission('quotes.create') or public.has_permission('quotes.update')); drop policy if exists "quotation items follow quotation access" on public.quotation_items;
drop policy if exists "quotation items follow quotation access" on public.quotation_items;
create policy "quotation items follow quotation access" on public.quotation_items for select using (exists (select 1 from public.quotations q where q.id = quotation_id and (public.has_permission('quotes.read') or exists (select 1 from public.customers c where c.id = q.customer_id and c.user_id = auth.uid()))));

