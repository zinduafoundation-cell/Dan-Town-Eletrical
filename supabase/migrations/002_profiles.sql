do $$ begin
  create type public.profile_status as enum ('ACTIVE', 'INACTIVE', 'SUSPENDED');
exception when duplicate_object then null;
end $$;;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  status public.profile_status not null default 'ACTIVE',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles are visible to their owner" on public.profiles;
create policy "profiles are visible to their owner" on public.profiles for select using (id = auth.uid());

drop policy if exists "users can update their profile" on public.profiles;
create policy "users can update their profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "staff can view profiles" on public.profiles;
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

