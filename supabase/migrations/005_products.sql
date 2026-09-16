do $$ begin
  create type public.product_status as enum ('DRAFT', 'ACTIVE', 'ARCHIVED');
exception when duplicate_object then null;
end $$;;

create table if not exists public.products (
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

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku citext not null unique,
  name text not null,
  attributes jsonb not null default '{}'::jsonb,
  price_adjustment numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (product_id, name)
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index one_primary_product_image on public.product_images(product_id) where is_primary;
create table if not exists public.product_specifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  specification_name text not null,
  specification_value text not null,
  sort_order integer not null default 0,
  unique (product_id, specification_name)
);

-- Trigger will be added below
-- Trigger will be added below
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
-- Trigger will be added below
-- Trigger will be added below
create trigger variants_updated_at before update on public.product_variants for each row execute function public.set_updated_at();
create index products_category_idx on public.products(category_id);
create index products_brand_idx on public.products(brand_id);
create index products_active_idx on public.products(is_active, status);
create index products_name_search_idx on public.products using gin (to_tsvector('english', name || ' ' || coalesce(description, '')));

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.product_specifications enable row level security;
drop policy if exists "active products are public" on public.products;
drop policy if exists "active products are public" on public.products;
create policy "active products are public" on public.products for select using (is_active or public.is_staff());
drop policy if exists "active variants are public" on public.product_variants;
drop policy if exists "active variants are public" on public.product_variants;
create policy "active variants are public" on public.product_variants for select using (is_active or public.is_staff());
drop policy if exists "product content is public" on public.product_images;
drop policy if exists "product content is public" on public.product_images;
create policy "product content is public" on public.product_images for select using (exists (select 1 from public.products p where p.id = product_id and (p.is_active or public.is_staff())));
drop policy if exists "product specifications are public" on public.product_specifications;
drop policy if exists "product specifications are public" on public.product_specifications;
create policy "product specifications are public" on public.product_specifications for select using (exists (select 1 from public.products p where p.id = product_id and (p.is_active or public.is_staff())));
drop policy if exists "authorized staff manage products" on public.products;
drop policy if exists "authorized staff manage products" on public.products;
create policy "authorized staff manage products" on public.products for all using (public.has_permission('products.update')) with check (public.has_permission('products.update'));
drop policy if exists "authorized staff manage product content" on public.product_images;
drop policy if exists "authorized staff manage product content" on public.product_images;
create policy "authorized staff manage product content" on public.product_images for all using (public.has_permission('products.update')) with check (public.has_permission('products.update'));
drop policy if exists "authorized staff manage specifications" on public.product_specifications;
drop policy if exists "authorized staff manage specifications" on public.product_specifications;
create policy "authorized staff manage specifications" on public.product_specifications for all using (public.has_permission('products.update')) with check (public.has_permission('products.update'));

