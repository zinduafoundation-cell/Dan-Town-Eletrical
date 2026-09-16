do $$ begin
  create type public.supplier_status as enum ('ACTIVE', 'INACTIVE', 'BLACKLISTED');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.purchase_order_status as enum ('DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
exception when duplicate_object then null;
end $$;
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(), company_name text not null, contact_name text, phone text, email citext, address text, tax_number text, payment_terms text, status public.supplier_status not null default 'ACTIVE', created_by uuid references auth.users(id), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.supplier_products (
  supplier_id uuid not null references public.suppliers(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, supplier_sku text, unit_cost numeric(12,2) not null check (unit_cost >= 0), lead_time_days integer check (lead_time_days >= 0), primary key (supplier_id, product_id)
);
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(), order_number text not null unique, supplier_id uuid not null references public.suppliers(id), warehouse_id uuid not null references public.warehouses(id), status public.purchase_order_status not null default 'DRAFT', subtotal numeric(12,2) not null default 0, tax numeric(12,2) not null default 0, total numeric(12,2) not null default 0, expected_at date, created_by uuid references auth.users(id), approved_by uuid references auth.users(id), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(), purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade, product_id uuid not null references public.products(id), quantity integer not null check (quantity > 0), received_quantity integer not null default 0 check (received_quantity >= 0 and received_quantity <= quantity), unit_cost numeric(12,2) not null check (unit_cost >= 0), unique (purchase_order_id, product_id)
);
-- Trigger will be added below
-- Trigger will be added below
create trigger suppliers_updated_at before update on public.suppliers for each row execute function public.set_updated_at(); -- Trigger will be added below
-- Trigger will be added below
create trigger purchase_orders_updated_at before update on public.purchase_orders for each row execute function public.set_updated_at();
create index suppliers_status_idx on public.suppliers(status); create index purchase_orders_supplier_idx on public.purchase_orders(supplier_id); create index purchase_orders_status_idx on public.purchase_orders(status);
alter table public.suppliers enable row level security; alter table public.supplier_products enable row level security; alter table public.purchase_orders enable row level security; alter table public.purchase_order_items enable row level security;
drop policy if exists "authorized staff read suppliers" on public.suppliers;
drop policy if exists "authorized staff read suppliers" on public.suppliers;
create policy "authorized staff read suppliers" on public.suppliers for select using (public.has_permission('products.read')); drop policy if exists "authorized staff manage suppliers" on public.suppliers;
drop policy if exists "authorized staff manage suppliers" on public.suppliers;
create policy "authorized staff manage suppliers" on public.suppliers for all using (public.has_permission('products.update')) with check (public.has_permission('products.update')); drop policy if exists "authorized staff manage purchase orders" on public.purchase_orders;
drop policy if exists "authorized staff manage purchase orders" on public.purchase_orders;
create policy "authorized staff manage purchase orders" on public.purchase_orders for all using (public.has_permission('inventory.adjust')) with check (public.has_permission('inventory.adjust'));

