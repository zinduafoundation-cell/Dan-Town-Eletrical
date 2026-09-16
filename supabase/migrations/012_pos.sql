do $$ begin
  create type public.pos_session_status as enum ('OPEN', 'CLOSED');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.pos_transaction_status as enum ('COMPLETED', 'VOIDED', 'REFUNDED');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.cash_movement_type as enum ('OPENING', 'SALE', 'REFUND', 'PAID_IN', 'PAID_OUT', 'CLOSING');
exception when duplicate_object then null;
end $$;
create table if not exists public.pos_sessions (
  id uuid primary key default gen_random_uuid(), employee_id uuid not null references auth.users(id), warehouse_id uuid not null references public.warehouses(id), status public.pos_session_status not null default 'OPEN', opening_balance numeric(12,2) not null default 0 check (opening_balance >= 0), closing_balance numeric(12,2) check (closing_balance >= 0), opened_at timestamptz not null default timezone('utc', now()), closed_at timestamptz
);
create table if not exists public.pos_transactions (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.pos_sessions(id), order_id uuid not null unique references public.orders(id), status public.pos_transaction_status not null default 'COMPLETED', subtotal numeric(12,2) not null, total numeric(12,2) not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.pos_transaction_items (
  id uuid primary key default gen_random_uuid(), transaction_id uuid not null references public.pos_transactions(id) on delete cascade, product_id uuid not null references public.products(id), variant_id uuid references public.product_variants(id), product_name_snapshot text not null, sku_snapshot text not null, quantity integer not null check (quantity > 0), unit_price numeric(12,2) not null, line_total numeric(12,2) not null
);
create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.pos_sessions(id), movement_type public.cash_movement_type not null, amount numeric(12,2) not null check (amount >= 0), reason text, created_by uuid references auth.users(id), created_at timestamptz not null default timezone('utc', now())
);
create index pos_sessions_employee_idx on public.pos_sessions(employee_id); create index pos_transactions_created_idx on public.pos_transactions(created_at);
alter table public.pos_sessions enable row level security; alter table public.pos_transactions enable row level security; alter table public.pos_transaction_items enable row level security; alter table public.cash_movements enable row level security;
drop policy if exists "cashiers read own sessions" on public.pos_sessions;
drop policy if exists "cashiers read own sessions" on public.pos_sessions;
create policy "cashiers read own sessions" on public.pos_sessions for select using (employee_id = auth.uid() or public.has_permission('orders.read')); drop policy if exists "cashiers manage sessions" on public.pos_sessions;
drop policy if exists "cashiers manage sessions" on public.pos_sessions;
create policy "cashiers manage sessions" on public.pos_sessions for all using (public.has_permission('orders.create')) with check (public.has_permission('orders.create')); drop policy if exists "authorized staff read POS" on public.pos_transactions;
drop policy if exists "authorized staff read POS" on public.pos_transactions;
create policy "authorized staff read POS" on public.pos_transactions for select using (public.has_permission('orders.read')); drop policy if exists "authorized staff manage POS" on public.pos_transactions;
drop policy if exists "authorized staff manage POS" on public.pos_transactions;
create policy "authorized staff manage POS" on public.pos_transactions for all using (public.has_permission('orders.create')) with check (public.has_permission('orders.create'));

