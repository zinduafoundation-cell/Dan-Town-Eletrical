do $$ begin
  create type public.delivery_status as enum ('PENDING', 'ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED');
exception when duplicate_object then null;
end $$;
create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id) on delete restrict, driver_id uuid references auth.users(id) on delete set null, status public.delivery_status not null default 'PENDING', address jsonb not null, tracking_reference text unique, scheduled_at timestamptz, delivered_at timestamptz, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.delivery_items (delivery_id uuid not null references public.deliveries(id) on delete cascade, order_item_id uuid not null references public.order_items(id) on delete restrict, quantity integer not null check (quantity > 0), primary key (delivery_id, order_item_id));
create table if not exists public.delivery_status_history (id uuid primary key default gen_random_uuid(), delivery_id uuid not null references public.deliveries(id) on delete cascade, previous_status public.delivery_status, new_status public.delivery_status not null, note text, changed_by uuid references auth.users(id), created_at timestamptz not null default timezone('utc', now()));
-- Trigger will be added below
-- Trigger will be added below
create trigger deliveries_updated_at before update on public.deliveries for each row execute function public.set_updated_at(); create index deliveries_status_idx on public.deliveries(status); create index deliveries_driver_idx on public.deliveries(driver_id);
alter table public.deliveries enable row level security; alter table public.delivery_items enable row level security; alter table public.delivery_status_history enable row level security;
drop policy if exists "customers read own deliveries" on public.deliveries;
drop policy if exists "customers read own deliveries" on public.deliveries;
create policy "customers read own deliveries" on public.deliveries for select using (exists (select 1 from public.orders o join public.customers c on c.id = o.customer_id where o.id = order_id and c.user_id = auth.uid()) or public.has_permission('orders.read')); drop policy if exists "delivery staff manage deliveries" on public.deliveries;
drop policy if exists "delivery staff manage deliveries" on public.deliveries;
create policy "delivery staff manage deliveries" on public.deliveries for all using (public.has_permission('orders.update')) with check (public.has_permission('orders.update'));

