create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, customer_id uuid references public.customers(id) on delete cascade, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), check (user_id is not null or customer_id is not null)
);
create unique index one_user_cart on public.carts(user_id) where user_id is not null; create unique index one_customer_cart on public.carts(customer_id) where customer_id is not null;
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(), cart_id uuid not null references public.carts(id) on delete cascade, product_id uuid not null references public.products(id), variant_id uuid references public.product_variants(id), quantity integer not null check (quantity > 0), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique (cart_id, product_id, variant_id)
);
create table if not exists public.wishlists (id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade, created_at timestamptz not null default timezone('utc', now()));
create table if not exists public.wishlist_items (wishlist_id uuid not null references public.wishlists(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, created_at timestamptz not null default timezone('utc', now()), primary key (wishlist_id, product_id));
-- Trigger will be added below
-- Trigger will be added below
create trigger carts_updated_at before update on public.carts for each row execute function public.set_updated_at(); -- Trigger will be added below
-- Trigger will be added below
create trigger cart_items_updated_at before update on public.cart_items for each row execute function public.set_updated_at();
alter table public.carts enable row level security; alter table public.cart_items enable row level security; alter table public.wishlists enable row level security; alter table public.wishlist_items enable row level security;
drop policy if exists "users own carts" on public.carts;
drop policy if exists "users own carts" on public.carts;
create policy "users own carts" on public.carts for all using (user_id = auth.uid()) with check (user_id = auth.uid()); drop policy if exists "users own cart items" on public.cart_items;
drop policy if exists "users own cart items" on public.cart_items;
create policy "users own cart items" on public.cart_items for all using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid())) with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid())); drop policy if exists "users own wishlists" on public.wishlists;
drop policy if exists "users own wishlists" on public.wishlists;
create policy "users own wishlists" on public.wishlists for all using (user_id = auth.uid()) with check (user_id = auth.uid()); drop policy if exists "users own wishlist items" on public.wishlist_items;
drop policy if exists "users own wishlist items" on public.wishlist_items;
create policy "users own wishlist items" on public.wishlist_items for all using (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid())) with check (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid()));

