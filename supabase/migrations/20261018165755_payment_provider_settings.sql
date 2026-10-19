create table public.payment_provider_settings (
  id text primary key default 'dantown' check (id = 'dantown'),
  online_pesapal_enabled boolean not null default true,
  pos_pesapal_enabled boolean not null default true,
  online_paystack_enabled boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.payment_provider_settings enable row level security;
revoke all on table public.payment_provider_settings from public, anon, authenticated, service_role;
grant select, insert, update on table public.payment_provider_settings to service_role;

insert into public.payment_provider_settings (id)
values ('dantown')
on conflict (id) do nothing;

create or replace function public.audit_payment_provider_settings_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  insert into public.audit_logs (user_id, action, resource_type, resource_id, old_data, new_data)
  values (
    new.updated_by,
    case when tg_op = 'INSERT' then 'PAYMENT_PROVIDER_SETTINGS_CREATED' else 'PAYMENT_PROVIDER_SETTINGS_UPDATED' end,
    'payment_provider_settings',
    null,
    case when tg_op = 'UPDATE' then to_jsonb(old) - 'updated_at' else null end,
    to_jsonb(new) - 'updated_at'
  );
  return new;
end;
$$;

revoke all on function public.audit_payment_provider_settings_change() from public, anon, authenticated;

create trigger payment_provider_settings_audit_change
after insert or update on public.payment_provider_settings
for each row execute function public.audit_payment_provider_settings_change();