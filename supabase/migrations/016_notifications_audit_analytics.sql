do $$ begin
  create type public.notification_type as enum ('ORDER', 'PAYMENT', 'DELIVERY', 'LOW_STOCK', 'QUOTE', 'SYSTEM', 'PROMOTION');
exception when duplicate_object then null;
end $$;
create table if not exists public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, type public.notification_type not null, title text not null, body text not null, data jsonb not null default '{}'::jsonb, read_at timestamptz, created_at timestamptz not null default timezone('utc', now()));
create table if not exists public.notification_preferences (user_id uuid primary key references auth.users(id) on delete cascade, email boolean not null default true, sms boolean not null default false, whatsapp boolean not null default false, push boolean not null default false, updated_at timestamptz not null default timezone('utc', now()));
create table if not exists public.audit_logs (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, action text not null, resource_type text not null, resource_id uuid, old_data jsonb, new_data jsonb, ip_address inet, created_at timestamptz not null default timezone('utc', now()));
create table if not exists public.analytics_events (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, session_id text, event_name text not null, product_id uuid references public.products(id) on delete set null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default timezone('utc', now()));
create index notifications_user_idx on public.notifications(user_id, created_at desc); create index audit_resource_idx on public.audit_logs(resource_type, resource_id); create index analytics_event_idx on public.analytics_events(event_name, created_at);
alter table public.notifications enable row level security; alter table public.notification_preferences enable row level security; alter table public.audit_logs enable row level security; alter table public.analytics_events enable row level security;
drop policy if exists "users read own notifications" on public.notifications;
drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications for select using (user_id = auth.uid()); drop policy if exists "users update own notifications" on public.notifications;
drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid()); drop policy if exists "users manage notification preferences" on public.notification_preferences;
drop policy if exists "users manage notification preferences" on public.notification_preferences;
create policy "users manage notification preferences" on public.notification_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid()); drop policy if exists "authorized staff read audit logs" on public.audit_logs;
drop policy if exists "authorized staff read audit logs" on public.audit_logs;
create policy "authorized staff read audit logs" on public.audit_logs for select using (public.has_permission('audit_logs.read')); drop policy if exists "users create own analytics events" on public.analytics_events;
drop policy if exists "users create own analytics events" on public.analytics_events;
create policy "users create own analytics events" on public.analytics_events for insert with check (user_id = auth.uid() or user_id is null); drop policy if exists "authorized staff read analytics" on public.analytics_events;
drop policy if exists "authorized staff read analytics" on public.analytics_events;
create policy "authorized staff read analytics" on public.analytics_events for select using (public.has_permission('reports.read'));

