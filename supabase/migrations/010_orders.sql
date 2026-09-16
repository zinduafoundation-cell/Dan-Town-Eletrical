do $$ begin
  create type public.order_status as enum ('PENDING', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'READY_FOR_PICKUP', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.payment_status as enum ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');
exception when duplicate_object then null;
end $$;
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), order_number text not null unique, customer_id uuid references public.customers(id) on delete set null, subtotal numeric(12,2) not null default 0 check (subtotal >= 0), discount numeric(12,2) not null default 0 check (discount >= 0), vat numeric(12,2) not null default 0 check (vat >= 0), delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0), total numeric(12,2) not null default 0 check (total >= 0), payment_status public.payment_status not null default 'PENDING', order_status public.order_status not null default 'PENDING', shipping_address jsonb, billing_address jsonb, notes text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, product_id uuid references public.products(id) on delete set null, variant_id uuid references public.product_variants(id) on delete set null, product_name_snapshot text not null, sku_snapshot text not null, unit_price numeric(12,2) not null check (unit_price >= 0), quantity integer not null check (quantity > 0), discount numeric(12,2) not null default 0, vat numeric(12,2) not null default 0, line_total numeric(12,2) not null check (line_total >= 0)
);
create table if not exists public.order_status_history (id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, previous_status public.order_status, new_status public.order_status not null, note text, changed_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default timezone('utc', now()));
-- Trigger will be added below
-- Trigger will be added below
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at(); create index orders_customer_idx on public.orders(customer_id); create index orders_status_idx on public.orders(order_status); create index orders_payment_status_idx on public.orders(payment_status); create index orders_created_idx on public.orders(created_at);
alter table public.orders enable row level security; alter table public.order_items enable row level security; alter table public.order_status_history enable row level security;
drop policy if exists "customers read own orders" on public.orders;
drop policy if exists "customers read own orders" on public.orders;
create policy "customers read own orders" on public.orders for select using (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid()) or public.has_permission('orders.read')); drop policy if exists "authorized users create orders" on public.orders;
drop policy if exists "authorized users create orders" on public.orders;
create policy "authorized users create orders" on public.orders for insert with check (customer_id is null or exists (select 1 from public.customers c where c.id = customer_id and (c.user_id = auth.uid() or public.has_permission('orders.create')))); drop policy if exists "staff update orders" on public.orders;
drop policy if exists "staff update orders" on public.orders;
create policy "staff update orders" on public.orders for update using (public.has_permission('orders.update')) with check (public.has_permission('orders.update')); drop policy if exists "customers read own order items" on public.order_items;
drop policy if exists "customers read own order items" on public.order_items;
create policy "customers read own order items" on public.order_items for select using (exists (select 1 from public.orders o join public.customers c on c.id = o.customer_id where o.id = order_id and c.user_id = auth.uid()) or public.has_permission('orders.read')); drop policy if exists "customers read own status history" on public.order_status_history;
drop policy if exists "customers read own status history" on public.order_status_history;
create policy "customers read own status history" on public.order_status_history for select using (exists (select 1 from public.orders o join public.customers c on c.id = o.customer_id where o.id = order_id and c.user_id = auth.uid()) or public.has_permission('orders.read'));

