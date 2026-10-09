create table if not exists public.paystack_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'PAYSTACK',
  event_name text not null,
  event_id text,
  provider_reference text,
  order_id uuid references public.orders(id) on delete set null,
  payload jsonb not null,
  received_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists paystack_webhook_events_provider_reference_idx on public.paystack_webhook_events(provider_reference);
create index if not exists paystack_webhook_events_order_idx on public.paystack_webhook_events(order_id);
create unique index if not exists paystack_webhook_events_event_id_unique
  on public.paystack_webhook_events(provider, event_name, event_id)
  where event_id is not null;

alter table public.paystack_webhook_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'paystack_webhook_events'
      and policyname = 'service role manages paystack webhook events'
  ) then
    create policy "service role manages paystack webhook events"
      on public.paystack_webhook_events
      as permissive
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;