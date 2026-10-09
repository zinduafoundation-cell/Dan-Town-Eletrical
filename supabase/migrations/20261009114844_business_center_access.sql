create table public.business_center_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (email = lower(email)),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz not null default timezone('utc', now())
);

create unique index business_center_access_email_unique
  on public.business_center_access (email);

alter table public.business_center_access enable row level security;

revoke all on table public.business_center_access from public, anon, authenticated;
grant all on table public.business_center_access to service_role;