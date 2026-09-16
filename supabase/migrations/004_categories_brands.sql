create table if not exists public.categories (
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

create table if not exists public.brands (
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

-- Trigger will be added below
-- Trigger will be added below
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
-- Trigger will be added below
-- Trigger will be added below
create trigger brands_updated_at before update on public.brands for each row execute function public.set_updated_at();
create index categories_parent_idx on public.categories(parent_id);
create index categories_active_sort_idx on public.categories(is_active, sort_order);

alter table public.categories enable row level security;
alter table public.brands enable row level security;
drop policy if exists "active categories are public" on public.categories;
drop policy if exists "active categories are public" on public.categories;
create policy "active categories are public" on public.categories for select using (is_active or public.is_staff());
drop policy if exists "active brands are public" on public.brands;
drop policy if exists "active brands are public" on public.brands;
create policy "active brands are public" on public.brands for select using (is_active or public.is_staff());
drop policy if exists "staff manage categories" on public.categories;
drop policy if exists "staff manage categories" on public.categories;
create policy "staff manage categories" on public.categories for all using (public.has_permission('products.update')) with check (public.has_permission('products.update'));
drop policy if exists "staff manage brands" on public.brands;
drop policy if exists "staff manage brands" on public.brands;
create policy "staff manage brands" on public.brands for all using (public.has_permission('products.update')) with check (public.has_permission('products.update'));

