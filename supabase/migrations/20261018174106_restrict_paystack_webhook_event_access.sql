alter table public.paystack_webhook_events enable row level security;

revoke all on table public.paystack_webhook_events from public, anon, authenticated, service_role;
grant select, insert on table public.paystack_webhook_events to service_role;