create table if not exists public.ai_knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_support_escalations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  guest_session_id text,
  category text not null,
  summary text not null,
  priority text not null default 'NORMAL' check (priority in ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  status text not null default 'OPEN' check (status in ('OPEN', 'ASSIGNED', 'RESOLVED', 'CLOSED')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create index if not exists ai_knowledge_status_category_idx on public.ai_knowledge_entries(status, category);
create index if not exists ai_escalations_status_created_idx on public.ai_support_escalations(status, created_at desc);
create index if not exists ai_escalations_user_idx on public.ai_support_escalations(user_id, created_at desc);

alter table public.ai_knowledge_entries enable row level security;
alter table public.ai_support_escalations enable row level security;

drop policy if exists "published AI knowledge is public" on public.ai_knowledge_entries;
create policy "published AI knowledge is public" on public.ai_knowledge_entries for select using (status = 'PUBLISHED');
drop policy if exists "authorized staff manage AI knowledge" on public.ai_knowledge_entries;
create policy "authorized staff manage AI knowledge" on public.ai_knowledge_entries for all using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
drop policy if exists "authorized staff read AI escalations" on public.ai_support_escalations;
create policy "authorized staff read AI escalations" on public.ai_support_escalations for select using (public.has_permission('orders.read'));