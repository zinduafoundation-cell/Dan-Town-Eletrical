do $$ begin
  create type public.payment_method as enum ('MPESA', 'CASH', 'CARD', 'BANK_TRANSFER', 'PAY_ON_PICKUP', 'COD');
exception when duplicate_object then null;
end $$;
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete restrict, method public.payment_method not null, status public.payment_status not null default 'PENDING', amount numeric(12,2) not null check (amount > 0), currency char(3) not null default 'KES', provider text, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(), payment_id uuid not null references public.payments(id) on delete cascade, provider_reference text unique, checkout_request_id text unique, merchant_request_id text, result_code text, result_description text, response_payload jsonb, status public.payment_status not null default 'PENDING', processed_at timestamptz, created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(), payment_id uuid not null references public.payments(id) on delete restrict, amount numeric(12,2) not null check (amount > 0), reason text not null, status public.payment_status not null default 'PENDING', requested_by uuid references auth.users(id), approved_by uuid references auth.users(id), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
-- Trigger will be added below
-- Trigger will be added below
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at(); -- Trigger will be added below
-- Trigger will be added below
create trigger refunds_updated_at before update on public.refunds for each row execute function public.set_updated_at(); create index payments_order_idx on public.payments(order_id); create index transactions_provider_idx on public.payment_transactions(provider_reference); 
alter table public.payments enable row level security; alter table public.payment_transactions enable row level security; alter table public.refunds enable row level security;
drop policy if exists "customers read own payments" on public.payments;
drop policy if exists "customers read own payments" on public.payments;
create policy "customers read own payments" on public.payments for select using (exists (select 1 from public.orders o join public.customers c on c.id = o.customer_id where o.id = order_id and c.user_id = auth.uid()) or public.has_permission('payments.read')); drop policy if exists "finance staff read transactions" on public.payment_transactions;
drop policy if exists "finance staff read transactions" on public.payment_transactions;
create policy "finance staff read transactions" on public.payment_transactions for select using (public.has_permission('payments.read')); drop policy if exists "authorized refund access" on public.refunds;
drop policy if exists "authorized refund access" on public.refunds;
create policy "authorized refund access" on public.refunds for all using (public.has_permission('refunds.request') or public.has_permission('refunds.approve')) with check (public.has_permission('refunds.request') or public.has_permission('refunds.approve'));

