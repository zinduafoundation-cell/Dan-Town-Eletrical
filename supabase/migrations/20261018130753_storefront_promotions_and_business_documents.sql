create table if not exists public.storefront_promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 120),
  description text not null default '' check (length(description) <= 600),
  badge text not null default 'Special offer' check (length(btrim(badge)) between 1 and 48),
  image_url text,
  destination_url text not null default '/deals',
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint storefront_promotions_window_check
    check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

create index if not exists storefront_promotions_visible_idx
  on public.storefront_promotions (sort_order, starts_at, ends_at)
  where is_active;

alter table public.storefront_promotions enable row level security;
revoke all on table public.storefront_promotions from public, anon, authenticated;
grant select, insert, update, delete on table public.storefront_promotions to service_role;

create table if not exists public.business_documents (
  id uuid primary key default gen_random_uuid(),
  document_number text not null unique check (length(btrim(document_number)) between 1 and 64),
  document_type text not null check (document_type in (
    'INVOICE', 'RECEIPT', 'DELIVERY_NOTE', 'PAYMENT_VOUCHER',
    'QUOTATION', 'PURCHASE_ORDER', 'CREDIT_NOTE', 'OTHER'
  )),
  customer_name text not null check (length(btrim(customer_name)) between 1 and 160),
  customer_contact text,
  issue_date date not null default current_date,
  due_date date,
  payment_method text,
  payment_terms text,
  currency text not null default 'KES' check (currency = 'KES'),
  line_items jsonb not null check (jsonb_typeof(line_items) = 'array'),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  tax numeric(12,2) not null default 0 check (tax >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  notes text not null default '' check (length(notes) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint business_documents_due_date_check
    check (due_date is null or due_date >= issue_date)
);

create index if not exists business_documents_created_idx
  on public.business_documents (created_at desc, id desc);

alter table public.business_documents enable row level security;
revoke all on table public.business_documents from public, anon, authenticated;
grant select, insert on table public.business_documents to service_role;