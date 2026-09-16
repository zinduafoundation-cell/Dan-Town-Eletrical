do $$ begin
  create type public.inventory_movement_type as enum ('PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'DAMAGE', 'STOCK_COUNT', 'RESERVATION', 'RELEASE');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.stock_count_status as enum ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.transfer_status as enum ('DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');
exception when duplicate_object then null;
end $$;

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(), name text not null, code text not null unique,
  location text, description text, manager_id uuid references auth.users(id) on delete set null,
  is_active boolean not null default true, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.warehouse_locations (
  id uuid primary key default gen_random_uuid(), warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  code text not null, name text not null, unique (warehouse_id, code)
);
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict, warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  location_id uuid references public.warehouse_locations(id) on delete set null, quantity integer not null default 0 check (quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0 and reserved_quantity <= quantity), reorder_level integer not null default 0 check (reorder_level >= 0),
  reorder_quantity integer not null default 0 check (reorder_quantity >= 0), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  unique (product_id, variant_id, warehouse_id, location_id)
);
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict, warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  quantity integer not null, movement_type public.inventory_movement_type not null, reference_type text, reference_id uuid,
  previous_quantity integer not null, new_quantity integer not null, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.stock_counts (
  id uuid primary key default gen_random_uuid(), warehouse_id uuid not null references public.warehouses(id), status public.stock_count_status not null default 'DRAFT', counted_by uuid references auth.users(id), completed_at timestamptz, created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.stock_count_items (
  id uuid primary key default gen_random_uuid(), stock_count_id uuid not null references public.stock_counts(id) on delete cascade, product_id uuid not null references public.products(id), expected_quantity integer not null, counted_quantity integer, unique (stock_count_id, product_id)
);
create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(), from_warehouse_id uuid not null references public.warehouses(id), to_warehouse_id uuid not null references public.warehouses(id), status public.transfer_status not null default 'DRAFT', created_by uuid references auth.users(id), received_by uuid references auth.users(id), created_at timestamptz not null default timezone('utc', now()), check (from_warehouse_id <> to_warehouse_id)
);
create table if not exists public.stock_transfer_items (
  id uuid primary key default gen_random_uuid(), transfer_id uuid not null references public.stock_transfers(id) on delete cascade, product_id uuid not null references public.products(id), quantity integer not null check (quantity > 0), unique (transfer_id, product_id)
);
-- Trigger will be added below
-- Trigger will be added below
create trigger warehouses_updated_at before update on public.warehouses for each row execute function public.set_updated_at();
-- Trigger will be added below
-- Trigger will be added below
create trigger inventory_updated_at before update on public.inventory for each row execute function public.set_updated_at();
create index inventory_product_idx on public.inventory(product_id); create index inventory_warehouse_idx on public.inventory(warehouse_id); create index movements_created_idx on public.inventory_movements(created_at); create index movements_reference_idx on public.inventory_movements(reference_type, reference_id);
alter table public.warehouses enable row level security; alter table public.warehouse_locations enable row level security; alter table public.inventory enable row level security; alter table public.inventory_movements enable row level security; alter table public.stock_counts enable row level security; alter table public.stock_count_items enable row level security; alter table public.stock_transfers enable row level security; alter table public.stock_transfer_items enable row level security;
drop policy if exists "active warehouses are readable" on public.warehouses;
drop policy if exists "active warehouses are readable" on public.warehouses;
create policy "active warehouses are readable" on public.warehouses for select using (is_active or public.is_staff()); drop policy if exists "staff read inventory" on public.inventory;
drop policy if exists "staff read inventory" on public.inventory;
create policy "staff read inventory" on public.inventory for select using (public.has_permission('inventory.read')); drop policy if exists "staff manage inventory" on public.inventory;
drop policy if exists "staff manage inventory" on public.inventory;
create policy "staff manage inventory" on public.inventory for all using (public.has_permission('inventory.adjust')) with check (public.has_permission('inventory.adjust')); drop policy if exists "staff read movements" on public.inventory_movements;
drop policy if exists "staff read movements" on public.inventory_movements;
create policy "staff read movements" on public.inventory_movements for select using (public.has_permission('inventory.read')); drop policy if exists "staff manage warehouse data" on public.warehouses;
drop policy if exists "staff manage warehouse data" on public.warehouses;
create policy "staff manage warehouse data" on public.warehouses for all using (public.has_permission('inventory.adjust')) with check (public.has_permission('inventory.adjust'));


