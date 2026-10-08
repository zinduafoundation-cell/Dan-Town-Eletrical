-- Biometric (passkey) sign-in and step-up for Dantown staff.
-- Only the PUBLIC key is stored. The fingerprint/face never leaves the phone.
create table if not exists public.staff_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  device_label text not null default 'This phone',
  created_at timestamptz not null default timezone('utc', now()),
  last_used_at timestamptz
);

create index if not exists staff_passkeys_user_idx on public.staff_passkeys(user_id);

-- Locked down: only the server (service role) reads or writes this table.
alter table public.staff_passkeys enable row level security;
revoke all on public.staff_passkeys from anon, authenticated;
