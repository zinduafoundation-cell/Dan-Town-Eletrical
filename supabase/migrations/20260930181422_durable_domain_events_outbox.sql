-- Durable operational outbox. Events are written from the existing audit trail
-- in the same transaction as the audited business action.
create table if not exists public.domain_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (char_length(event_name) between 3 and 160),
  aggregate_type text not null check (char_length(aggregate_type) between 1 and 120),
  aggregate_id uuid,
  correlation_id uuid not null default gen_random_uuid(),
  idempotency_key text,
  actor_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSING', 'DELIVERED', 'RETRY', 'DEAD_LETTER')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default timezone('utc', now()),
  claimed_at timestamptz,
  claimed_by text,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists domain_events_idempotency_key_idx
  on public.domain_events (idempotency_key)
  where idempotency_key is not null;

create index if not exists domain_events_dispatch_queue_idx
  on public.domain_events (available_at asc, created_at asc)
  where status in ('PENDING', 'RETRY');

create index if not exists domain_events_aggregate_idx
  on public.domain_events (aggregate_type, aggregate_id, created_at desc);

alter table public.domain_events enable row level security;

revoke all on table public.domain_events from anon, authenticated;
grant select, insert, update, delete on table public.domain_events to service_role;

-- This is deliberately SECURITY DEFINER: the trigger is the only supported
-- writer for events derived from an audit record, and direct callers cannot
-- execute it. It preserves the audited operation for authorized invoker flows
-- without granting them access to the private outbox.
create or replace function public.enqueue_audit_log_domain_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.domain_events (
    event_name,
    aggregate_type,
    aggregate_id,
    idempotency_key,
    actor_user_id,
    payload
  ) values (
    'audit.' || lower(new.action),
    new.resource_type,
    new.resource_id,
    'audit-log:' || new.id::text,
    new.user_id,
    jsonb_build_object(
      'audit_log_id', new.id,
      'action', new.action,
      'resource_type', new.resource_type,
      'resource_id', new.resource_id,
      'old_data', new.old_data,
      'new_data', new.new_data,
      'occurred_at', new.created_at
    )
  ) on conflict (idempotency_key) where idempotency_key is not null do nothing;

  return new;
end;
$$;

revoke all on function public.enqueue_audit_log_domain_event() from public;

drop trigger if exists audit_logs_enqueue_domain_event on public.audit_logs;
create trigger audit_logs_enqueue_domain_event
after insert on public.audit_logs
for each row execute function public.enqueue_audit_log_domain_event();

notify pgrst, 'reload schema';
