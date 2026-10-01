-- Concurrent workers claim small batches with SKIP LOCKED. A worker lease
-- prevents a transient process failure from leaving an event permanently held.
create or replace function public.claim_domain_events(
  worker_id text,
  batch_size integer default 20,
  lease_seconds integer default 120
)
returns setof public.domain_events
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  safe_batch_size integer := least(greatest(coalesce(batch_size, 20), 1), 100);
  safe_lease_seconds integer := least(greatest(coalesce(lease_seconds, 120), 30), 3600);
begin
  if char_length(trim(coalesce(worker_id, ''))) < 8 then
    raise exception 'A worker identifier is required';
  end if;

  return query
  with candidates as (
    select event.id
    from public.domain_events event
    where (
      event.status in ('PENDING', 'RETRY') and event.available_at <= timezone('utc', now())
    ) or (
      event.status = 'PROCESSING'
      and event.claimed_at < timezone('utc', now()) - make_interval(secs => safe_lease_seconds)
    )
    order by event.available_at asc, event.created_at asc
    for update skip locked
    limit safe_batch_size
  )
  update public.domain_events event
  set
    status = 'PROCESSING',
    attempts = event.attempts + 1,
    claimed_at = timezone('utc', now()),
    claimed_by = worker_id,
    updated_at = timezone('utc', now())
  from candidates
  where event.id = candidates.id
  returning event.*;
end;
$$;

create or replace function public.ack_domain_event(
  event_id uuid,
  worker_id text
)
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
  with acknowledged as (
    update public.domain_events
    set
      status = 'DELIVERED',
      delivered_at = timezone('utc', now()),
      last_error = null,
      updated_at = timezone('utc', now())
    where id = event_id
      and status = 'PROCESSING'
      and claimed_by = worker_id
    returning id
  )
  select exists(select 1 from acknowledged);
$$;

create or replace function public.retry_domain_event(
  event_id uuid,
  worker_id text,
  failure_reason text
)
returns text
language sql
security invoker
set search_path = pg_catalog, public
as $$
  with retried as (
    update public.domain_events
    set
      status = case when attempts >= 8 then 'DEAD_LETTER' else 'RETRY' end,
      available_at = case
        when attempts >= 8 then available_at
        else timezone('utc', now()) + interval '15 seconds' * power(2, least(attempts, 8))
      end,
      claimed_at = null,
      claimed_by = null,
      last_error = left(coalesce(nullif(trim(failure_reason), ''), 'Unknown dispatch failure'), 2000),
      updated_at = timezone('utc', now())
    where id = event_id
      and status = 'PROCESSING'
      and claimed_by = worker_id
    returning status
  )
  select status from retried;
$$;

revoke all on function public.claim_domain_events(text, integer, integer) from public;
revoke all on function public.ack_domain_event(uuid, text) from public;
revoke all on function public.retry_domain_event(uuid, text, text) from public;
grant execute on function public.claim_domain_events(text, integer, integer) to service_role;
grant execute on function public.ack_domain_event(uuid, text) to service_role;
grant execute on function public.retry_domain_event(uuid, text, text) to service_role;

notify pgrst, 'reload schema';
