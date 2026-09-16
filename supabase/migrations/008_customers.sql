do $$ begin
  create type public.customer_type as enum ('RETAIL', 'CONTRACTOR', 'WHOLESALE', 'DEALER', 'CORPORATE');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.customer_status as enum ('ACTIVE', 'INACTIVE', 'SUSPENDED');
exception when duplicate_object then null;
end $$;
create table if not exists public.customer_groups (id uuid primary key default gen_random_uuid(), name text not null unique, description text, discount_rate numeric(5,2) not null default 0 check (discount_rate between 0 and 100));
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), user_id uuid unique references auth.users(id) on delete set null, name text not null, phone text, email citext, customer_type public.customer_type not null default 'RETAIL', tax_number text, notes text, credit_limit numeric(12,2) not null default 0 check (credit_limit >= 0), customer_group_id uuid references public.customer_groups(id) on delete set null, status public.customer_status not null default 'ACTIVE', created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade, label text not null default 'Primary', recipient_name text not null, phone text, address_line_1 text not null, address_line_2 text, city text, county text, postal_code text, is_default boolean not null default false, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create unique index one_default_customer_address on public.customer_addresses(customer_id) where is_default;
-- Trigger will be added below
-- Trigger will be added below
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at(); -- Trigger will be added below
-- Trigger will be added below
create trigger addresses_updated_at before update on public.customer_addresses for each row execute function public.set_updated_at();
create index customers_user_idx on public.customers(user_id); create index customers_phone_idx on public.customers(phone); create index customers_email_idx on public.customers(email);
alter table public.customer_groups enable row level security; alter table public.customers enable row level security; alter table public.customer_addresses enable row level security;
drop policy if exists "customers see own record" on public.customers;
drop policy if exists "customers see own record" on public.customers;
create policy "customers see own record" on public.customers for select using (user_id = auth.uid() or public.has_permission('customers.read')); drop policy if exists "customers update own record" on public.customers;
drop policy if exists "customers update own record" on public.customers;
create policy "customers update own record" on public.customers for update using (user_id = auth.uid()) with check (user_id = auth.uid()); drop policy if exists "customers see own addresses" on public.customer_addresses;
drop policy if exists "customers see own addresses" on public.customer_addresses;
create policy "customers see own addresses" on public.customer_addresses for select using (exists (select 1 from public.customers c where c.id = customer_id and (c.user_id = auth.uid() or public.has_permission('customers.read')))); drop policy if exists "customers manage own addresses" on public.customer_addresses;
drop policy if exists "customers manage own addresses" on public.customer_addresses;
create policy "customers manage own addresses" on public.customer_addresses for all using (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid())) with check (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid()));

