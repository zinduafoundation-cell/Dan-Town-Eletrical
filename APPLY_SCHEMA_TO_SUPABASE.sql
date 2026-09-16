-- Dantown Electrical - Essential Database Schema
-- This file combines all required migrations for the app to function
-- Execute this in the Supabase SQL Editor at: https://app.supabase.com/project/vldccdtuwwyumqdkyxde/sql

-- =================================================================
-- 001_extensions.sql - Enable required PostgreSQL extensions
-- =================================================================
create extension if not exists pgcrypto;
create extension if not exists citext;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.code <> 'CUSTOMER'
  );
$$;

create or replace function public.has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid() and p.code = permission_code
  );
$$;

-- =================================================================
-- 002_profiles.sql - User profiles
-- =================================================================
create type public.profile_status as enum ('ACTIVE', 'INACTIVE', 'SUSPENDED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  status public.profile_status not null default 'ACTIVE',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
create policy "profiles are visible to their owner" on public.profiles for select using (id = auth.uid());
create policy "users can update their profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "staff can view profiles" on public.profiles for select using (public.is_staff());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.phone);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- =================================================================
-- 003_roles_permissions.sql - RBAC setup
-- =================================================================
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, role_id)
);

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
create policy "authenticated users can read roles" on public.roles for select to authenticated using (true);
create policy "authenticated users can read permissions" on public.permissions for select to authenticated using (true);
create policy "authenticated users can read role permissions" on public.role_permissions for select to authenticated using (true);
create policy "users can read their roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_staff());

-- =================================================================
-- 004_categories_brands.sql - Product categories and brands
-- =================================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  parent_id uuid references public.categories(id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  logo_url text,
  website text,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger brands_updated_at before update on public.brands for each row execute function public.set_updated_at();
create index categories_parent_idx on public.categories(parent_id);
create index categories_active_sort_idx on public.categories(is_active, sort_order);

alter table public.categories enable row level security;
alter table public.brands enable row level security;
create policy "active categories are public" on public.categories for select using (is_active or public.is_staff());
create policy "active brands are public" on public.brands for select using (is_active or public.is_staff());
create policy "staff manage categories" on public.categories for all using (public.has_permission('products.update')) with check (public.has_permission('products.update'));
create policy "staff manage brands" on public.brands for all using (public.has_permission('products.update')) with check (public.has_permission('products.update'));

-- =================================================================
-- 005_products.sql - Products and related tables
-- =================================================================
create type public.product_status as enum ('DRAFT', 'ACTIVE', 'ARCHIVED');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku citext not null unique,
  barcode citext unique,
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  retail_price numeric(12,2) not null check (retail_price >= 0),
  contractor_price numeric(12,2) check (contractor_price >= 0),
  wholesale_price numeric(12,2) check (wholesale_price >= 0),
  dealer_price numeric(12,2) check (dealer_price >= 0),
  promotional_price numeric(12,2) check (promotional_price >= 0),
  vat_rate numeric(5,2) not null default 16 check (vat_rate between 0 and 100),
  weight numeric(10,3) check (weight >= 0),
  length numeric(10,3) check (length >= 0),
  width numeric(10,3) check (width >= 0),
  height numeric(10,3) check (height >= 0),
  warranty_period integer check (warranty_period >= 0),
  status public.product_status not null default 'DRAFT',
  featured boolean not null default false,
  is_active boolean not null default false,
  seo_title text,
  seo_description text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create index products_category_idx on public.products(category_id);
create index products_brand_idx on public.products(brand_id);
create index products_slug_idx on public.products(slug);
create index products_active_idx on public.products(is_active);

alter table public.products enable row level security;
create policy "active products are public" on public.products for select using (is_active or public.is_staff());
create policy "staff manage products" on public.products for all using (public.has_permission('products.update')) with check (public.has_permission('products.update'));

-- =================================================================
-- 008_customers.sql - Customer accounts
-- =================================================================
create type public.customer_type as enum ('RETAIL', 'CONTRACTOR', 'WHOLESALE', 'DEALER', 'CORPORATE');
create type public.customer_status as enum ('ACTIVE', 'INACTIVE', 'SUSPENDED');

create table public.customer_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  discount_rate numeric(5,2) not null default 0 check (discount_rate between 0 and 100)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  phone text,
  email citext,
  customer_type public.customer_type not null default 'RETAIL',
  tax_number text,
  notes text,
  credit_limit numeric(12,2) not null default 0 check (credit_limit >= 0),
  customer_group_id uuid references public.customer_groups(id) on delete set null,
  status public.customer_status not null default 'ACTIVE',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text not null default 'Primary',
  recipient_name text not null,
  phone text,
  address_line_1 text not null,
  address_line_2 text,
  city text,
  county text,
  postal_code text,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index one_default_customer_address on public.customer_addresses(customer_id) where is_default;
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger addresses_updated_at before update on public.customer_addresses for each row execute function public.set_updated_at();
create index customers_user_idx on public.customers(user_id);
create index customers_phone_idx on public.customers(phone);
create index customers_email_idx on public.customers(email);

alter table public.customer_groups enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;

create policy "customers see own record" on public.customers for select using (user_id = auth.uid() or public.has_permission('customers.read'));
create policy "customers update own record" on public.customers for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "customers see own addresses" on public.customer_addresses for select using (exists (select 1 from public.customers c where c.id = customer_id and (c.user_id = auth.uid() or public.has_permission('customers.read'))));
create policy "customers manage own addresses" on public.customer_addresses for all using (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid())) with check (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid()));

-- =================================================================
-- 009_cart_wishlist.sql - Shopping carts and wishlists
-- =================================================================
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (user_id is not null or customer_id is not null)
);

create unique index one_user_cart on public.carts(user_id) where user_id is not null;
create unique index one_customer_cart on public.carts(customer_id) where customer_id is not null;

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (cart_id, product_id)
);

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.wishlist_items (
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (wishlist_id, product_id)
);

create trigger carts_updated_at before update on public.carts for each row execute function public.set_updated_at();
create trigger cart_items_updated_at before update on public.cart_items for each row execute function public.set_updated_at();

alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;

create policy "users own carts" on public.carts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users own cart items" on public.cart_items for all using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid())) with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));
create policy "users own wishlists" on public.wishlists for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users own wishlist items" on public.wishlist_items for all using (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid())) with check (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid()));
