create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.user_roles (
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
drop policy if exists "authenticated users can read roles" on public.roles;
drop policy if exists "authenticated users can read roles" on public.roles;
create policy "authenticated users can read roles" on public.roles for select to authenticated using (true);
drop policy if exists "authenticated users can read permissions" on public.permissions;
drop policy if exists "authenticated users can read permissions" on public.permissions;
create policy "authenticated users can read permissions" on public.permissions for select to authenticated using (true);
drop policy if exists "authenticated users can read role permissions" on public.role_permissions;
drop policy if exists "authenticated users can read role permissions" on public.role_permissions;
create policy "authenticated users can read role permissions" on public.role_permissions for select to authenticated using (true);
drop policy if exists "users can read their roles" on public.user_roles;
drop policy if exists "users can read their roles" on public.user_roles;
create policy "users can read their roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_staff());

