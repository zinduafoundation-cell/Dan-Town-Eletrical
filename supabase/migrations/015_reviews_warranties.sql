do $$ begin
  create type public.review_status as enum ('PENDING', 'APPROVED', 'REJECTED');
exception when duplicate_object then null;
end $$;
create table if not exists public.reviews (id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade, customer_id uuid not null references public.customers(id) on delete cascade, order_item_id uuid references public.order_items(id) on delete set null, rating integer not null check (rating between 1 and 5), title text, comment text, verified_purchase boolean not null default false, status public.review_status not null default 'PENDING', created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique (product_id, customer_id, order_item_id));
create table if not exists public.review_votes (review_id uuid not null references public.reviews(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, helpful boolean not null, primary key (review_id, user_id));
do $$ begin
  create type public.warranty_claim_status as enum ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED');
exception when duplicate_object then null;
end $$;
create table if not exists public.warranties (id uuid primary key default gen_random_uuid(), order_item_id uuid not null unique references public.order_items(id) on delete restrict, product_id uuid not null references public.products(id), customer_id uuid not null references public.customers(id), purchase_date date not null, expiry_date date not null, created_at timestamptz not null default timezone('utc', now()), check (expiry_date >= purchase_date));
create table if not exists public.warranty_claims (id uuid primary key default gen_random_uuid(), warranty_id uuid not null references public.warranties(id) on delete cascade, status public.warranty_claim_status not null default 'SUBMITTED', issue text not null, resolution text, documents jsonb not null default '[]'::jsonb, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()));
alter table public.reviews enable row level security; alter table public.review_votes enable row level security; alter table public.warranties enable row level security; alter table public.warranty_claims enable row level security;
drop policy if exists "approved reviews are public" on public.reviews;
drop policy if exists "approved reviews are public" on public.reviews;
create policy "approved reviews are public" on public.reviews for select using (status = 'APPROVED' or public.has_permission('products.update') or exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid())); drop policy if exists "customers manage own reviews" on public.reviews;
drop policy if exists "customers manage own reviews" on public.reviews;
create policy "customers manage own reviews" on public.reviews for insert with check (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid())); drop policy if exists "customers read own warranties" on public.warranties;
drop policy if exists "customers read own warranties" on public.warranties;
create policy "customers read own warranties" on public.warranties for select using (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid()) or public.has_permission('orders.read')); drop policy if exists "customers manage own claims" on public.warranty_claims;
drop policy if exists "customers manage own claims" on public.warranty_claims;
create policy "customers manage own claims" on public.warranty_claims for all using (exists (select 1 from public.warranties w join public.customers c on c.id = w.customer_id where w.id = warranty_id and c.user_id = auth.uid())) with check (exists (select 1 from public.warranties w join public.customers c on c.id = w.customer_id where w.id = warranty_id and c.user_id = auth.uid()));

