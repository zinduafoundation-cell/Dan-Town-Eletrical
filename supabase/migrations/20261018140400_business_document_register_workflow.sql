alter table public.business_documents
  add column if not exists document_group text not null default 'SALES',
  add column if not exists document_title text,
  add column if not exists document_status text not null default 'DRAFT',
  add column if not exists counterparty_type text not null default 'CUSTOMER',
  add column if not exists related_document_id uuid references public.business_documents(id) on delete restrict,
  add column if not exists tax_pin text,
  add column if not exists related_reference text,
  add column if not exists terms_and_conditions text not null default '',
  add column if not exists prepared_by text,
  add column if not exists checked_by text,
  add column if not exists approved_by text,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists financial_year integer;

alter table public.business_documents
  alter column customer_name drop not null,
  drop constraint if exists business_documents_customer_name_check;

alter table public.business_documents
  add constraint business_documents_customer_name_check check (
    customer_name is null or length(btrim(customer_name)) between 1 and 160
  ),
  add constraint business_documents_title_length_check check (
    document_title is null or length(btrim(document_title)) between 1 and 160
  );

alter table public.business_documents
  drop constraint if exists business_documents_document_type_check;

alter table public.business_documents
  add constraint business_documents_document_type_check check (document_type in (
    'QUOTATION', 'SALES_ORDER', 'PROFORMA_INVOICE', 'INVOICE', 'RECEIPT',
    'CREDIT_NOTE', 'DEBIT_NOTE', 'CUSTOMER_STATEMENT', 'SALES_RETURN_FORM',
    'PURCHASE_REQUISITION', 'PURCHASE_ORDER', 'SUPPLIER_INVOICE',
    'GOODS_RECEIVED_NOTE', 'SUPPLIER_PAYMENT_VOUCHER', 'SUPPLIER_STATEMENT',
    'PURCHASE_RETURN_FORM', 'STOCK_REGISTER', 'GOODS_ISSUE', 'STOCK_TRANSFER_NOTE',
    'DELIVERY_NOTE', 'DISPATCH_NOTE', 'STOCK_ADJUSTMENT', 'STOCK_COUNT_SHEET',
    'DAMAGED_GOODS_REPORT', 'GOODS_RETURN_NOTE', 'CASH_RECEIPT_VOUCHER',
    'PAYMENT_VOUCHER', 'PETTY_CASH_VOUCHER', 'CASHBOOK', 'DAILY_SALES_REPORT',
    'DAILY_EXPENSE_REPORT', 'BANK_RECONCILIATION', 'MPESA_RECONCILIATION',
    'ACCOUNTS_RECEIVABLE_REPORT', 'ACCOUNTS_PAYABLE_REPORT', 'PROFIT_AND_LOSS_REPORT',
    'GENERAL_LEDGER_REPORT', 'CUSTOMER_REGISTRATION', 'SUPPLIER_REGISTRATION',
    'CREDIT_APPLICATION', 'CUSTOMER_ACCOUNT_RECORD', 'SUPPLIER_ACCOUNT_RECORD',
    'COMPLAINT_RETURN_FORM', 'BUSINESS_REGISTRATION_RECORD', 'KRA_RECORD',
    'ETIMS_TAX_INVOICE', 'VAT_RECORD', 'TAX_RETURN_SUPPORT', 'BUSINESS_PERMIT',
    'REGISTRATION_CERTIFICATE', 'CONTRACT', 'EMPLOYEE_RECORD', 'PAYROLL_DOCUMENT',
    'LEAVE_RECORD', 'ASSET_REGISTER', 'INTERNAL_APPROVAL', 'INCIDENT_REPORT',
    'FILING_REGISTER', 'OTHER'
  ));

alter table public.business_documents
  add constraint business_documents_group_check check (document_group in (
    'SALES', 'PURCHASES', 'INVENTORY', 'FINANCE', 'PARTIES',
    'COMPLIANCE', 'ADMINISTRATION', 'REPORTS', 'ARCHIVE'
  )),
  add constraint business_documents_status_check check (document_status in (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'CONFIRMED',
    'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', 'REVERSED', 'ARCHIVED'
  )),
  add constraint business_documents_counterparty_type_check check (counterparty_type in (
    'CUSTOMER', 'SUPPLIER', 'INTERNAL'
  )),
  add constraint business_documents_financial_year_check check (
    financial_year is null or financial_year between 2000 and 2200
  ),
  add constraint business_documents_tax_pin_length_check check (
    tax_pin is null or length(tax_pin) <= 24
  ),
  add constraint business_documents_related_reference_length_check check (
    related_reference is null or length(related_reference) <= 160
  ),
  add constraint business_documents_terms_length_check check (
    length(terms_and_conditions) <= 3000
  ),
  add constraint business_documents_staff_names_length_check check (
    (prepared_by is null or length(prepared_by) <= 160)
    and (checked_by is null or length(checked_by) <= 160)
    and (approved_by is null or length(approved_by) <= 160)
  );

create table if not exists public.business_document_sequences (
  document_type text not null,
  financial_year integer not null check (financial_year between 2000 and 2200),
  last_number bigint not null check (last_number > 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (document_type, financial_year)
);

alter table public.business_document_sequences enable row level security;
revoke all on table public.business_document_sequences from public, anon, authenticated;
grant select, insert, update on table public.business_document_sequences to service_role;

create table if not exists public.business_document_events (
  id uuid primary key default gen_random_uuid(),
  business_document_id uuid not null references public.business_documents(id) on delete restrict,
  event_type text not null check (event_type in ('CREATED', 'STATUS_CHANGED', 'ATTACHMENT_ADDED')),
  previous_status text,
  new_status text not null,
  note text not null default '' check (length(note) <= 500),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.business_document_attachments (
  id uuid primary key default gen_random_uuid(),
  business_document_id uuid not null references public.business_documents(id) on delete restrict,
  storage_path text not null unique,
  file_name text not null check (length(btrim(file_name)) between 1 and 240),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists business_document_attachments_document_created_idx
  on public.business_document_attachments (business_document_id, created_at desc);

alter table public.business_document_attachments enable row level security;
revoke all on table public.business_document_attachments from public, anon, authenticated;
grant select, insert on table public.business_document_attachments to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-documents-private',
  'business-documents-private',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = excluded.allowed_mime_types;

create index if not exists business_document_events_document_created_idx
  on public.business_document_events (business_document_id, created_at desc);

alter table public.business_document_events enable row level security;
revoke all on table public.business_document_events from public, anon, authenticated;
grant select, insert on table public.business_document_events to service_role;
grant update on table public.business_documents to service_role;

create index if not exists business_documents_type_issue_date_idx
  on public.business_documents (document_group, document_type, issue_date desc, id desc);

create index if not exists business_documents_party_issue_date_idx
  on public.business_documents (customer_name, issue_date desc, id desc);

create or replace function public.assign_business_document_number()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  prefix text;
  configured_prefix text;
  business_code text;
  financial_year_start_month integer;
  current_year integer;
  next_number bigint;
begin
  select
    coalesce(nullif(template->>'businessCode', ''), 'DT'),
    case
      when coalesce(template->>'financialYearStartMonth', '') ~ '^(1[0-2]|[1-9])$'
        then (template->>'financialYearStartMonth')::integer
      else 1
    end,
    template->'documentPrefixes'->>new.document_type
  into business_code, financial_year_start_month, configured_prefix
  from public.business_document_settings
  where id = 'dantown';
  business_code := coalesce(business_code, 'DT');
  financial_year_start_month := coalesce(financial_year_start_month, 1);

  prefix := case new.document_type
    when 'QUOTATION' then 'QUO'
    when 'SALES_ORDER' then 'SO'
    when 'PROFORMA_INVOICE' then 'PI'
    when 'INVOICE' then 'INV'
    when 'RECEIPT' then 'REC'
    when 'CREDIT_NOTE' then 'CN'
    when 'DEBIT_NOTE' then 'DBN'
    when 'CUSTOMER_STATEMENT' then 'CST'
    when 'SALES_RETURN_FORM' then 'SRF'
    when 'PURCHASE_REQUISITION' then 'PR'
    when 'PURCHASE_ORDER' then 'PO'
    when 'SUPPLIER_INVOICE' then 'BILL'
    when 'GOODS_RECEIVED_NOTE' then 'GRN'
    when 'SUPPLIER_PAYMENT_VOUCHER' then 'SPV'
    when 'SUPPLIER_STATEMENT' then 'SST'
    when 'PURCHASE_RETURN_FORM' then 'PRN'
    when 'STOCK_REGISTER' then 'STR'
    when 'GOODS_ISSUE' then 'GI'
    when 'STOCK_TRANSFER_NOTE' then 'STN'
    when 'DELIVERY_NOTE' then 'DN'
    when 'DISPATCH_NOTE' then 'DIS'
    when 'STOCK_ADJUSTMENT' then 'SA'
    when 'STOCK_COUNT_SHEET' then 'SCS'
    when 'DAMAGED_GOODS_REPORT' then 'DGR'
    when 'GOODS_RETURN_NOTE' then 'SRN'
    when 'CASH_RECEIPT_VOUCHER' then 'CRV'
    when 'PAYMENT_VOUCHER' then 'PV'
    when 'PETTY_CASH_VOUCHER' then 'PCV'
    when 'CASHBOOK' then 'CB'
    when 'DAILY_SALES_REPORT' then 'DSR'
    when 'DAILY_EXPENSE_REPORT' then 'DER'
    when 'BANK_RECONCILIATION' then 'BR'
    when 'MPESA_RECONCILIATION' then 'MR'
    when 'ACCOUNTS_RECEIVABLE_REPORT' then 'ARPT'
    when 'ACCOUNTS_PAYABLE_REPORT' then 'APPT'
    when 'PROFIT_AND_LOSS_REPORT' then 'PL'
    when 'GENERAL_LEDGER_REPORT' then 'GL'
    when 'CUSTOMER_REGISTRATION' then 'CUS'
    when 'SUPPLIER_REGISTRATION' then 'SUP'
    when 'CREDIT_APPLICATION' then 'CA'
    when 'CUSTOMER_ACCOUNT_RECORD' then 'CAR'
    when 'SUPPLIER_ACCOUNT_RECORD' then 'SAR'
    when 'COMPLAINT_RETURN_FORM' then 'CRF'
    when 'BUSINESS_REGISTRATION_RECORD' then 'BRR'
    when 'KRA_RECORD' then 'KRA'
    when 'ETIMS_TAX_INVOICE' then 'ETI'
    when 'VAT_RECORD' then 'VAT'
    when 'TAX_RETURN_SUPPORT' then 'TRS'
    when 'BUSINESS_PERMIT' then 'BP'
    when 'REGISTRATION_CERTIFICATE' then 'RC'
    when 'CONTRACT' then 'CON'
    when 'EMPLOYEE_RECORD' then 'EMP'
    when 'PAYROLL_DOCUMENT' then 'PAY'
    when 'LEAVE_RECORD' then 'LEV'
    when 'ASSET_REGISTER' then 'AST'
    when 'INTERNAL_APPROVAL' then 'IAP'
    when 'INCIDENT_REPORT' then 'IR'
    when 'FILING_REGISTER' then 'FR'
    else 'DOC'
  end;
  if coalesce(configured_prefix, '') ~ '^[A-Z0-9]{1,8}$' then
    prefix := configured_prefix;
  end if;
  current_year := extract(year from new.issue_date)::integer;
  if extract(month from new.issue_date)::integer < financial_year_start_month then
    current_year := current_year - 1;
  end if;

  insert into public.business_document_sequences (document_type, financial_year, last_number)
  values (new.document_type, current_year, 1)
  on conflict (document_type, financial_year)
  do update set
    last_number = public.business_document_sequences.last_number + 1,
    updated_at = timezone('utc', now())
  returning last_number into next_number;

  new.financial_year := current_year;
  new.document_number := business_code || '-' || prefix || '-' || current_year::text || '-' || lpad(next_number::text, 4, '0');
  return new;
end;
$$;

create or replace function public.audit_business_document_settings_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' and old.template is not distinct from new.template then
    return new;
  end if;

  insert into public.audit_logs (user_id, action, resource_type, old_data, new_data)
  values (
    new.updated_by,
    case when tg_op = 'INSERT' then 'BUSINESS_DOCUMENT_SETTINGS_CREATED' else 'BUSINESS_DOCUMENT_SETTINGS_UPDATED' end,
    'business_document_settings',
    case when tg_op = 'INSERT' then null else jsonb_build_object('template', old.template - 'kraPin') end,
    jsonb_build_object('template', new.template - 'kraPin')
  );
  return new;
end;
$$;

create or replace function public.audit_business_document_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.business_document_events (
      business_document_id, event_type, new_status, actor_id
    ) values (
      new.id, 'CREATED', new.document_status, new.created_by
    );
  elsif new.document_status is distinct from old.document_status then
    insert into public.business_document_events (
      business_document_id, event_type, previous_status, new_status, note, actor_id
    ) values (
      new.id,
      'STATUS_CHANGED',
      old.document_status,
      new.document_status,
      coalesce(current_setting('app.business_document_note', true), ''),
      new.updated_by
    );
  end if;
  return new;
end;
$$;

create or replace function public.audit_business_document_attachment()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  insert into public.business_document_events (
    business_document_id, event_type, new_status, note, actor_id
  )
  select
    new.business_document_id,
    'ATTACHMENT_ADDED',
    document.document_status,
    new.file_name,
    new.uploaded_by
  from public.business_documents as document
  where document.id = new.business_document_id;
  return new;
end;
$$;

create or replace function public.transition_business_document(
  target_document_id uuid,
  target_status text,
  transition_note text,
  actor_user_id uuid
)
returns public.business_documents
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  document_row public.business_documents;
  allowed_transition boolean;
begin
  if target_status not in (
    'PENDING_APPROVAL', 'APPROVED', 'SENT', 'CONFIRMED',
    'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', 'REVERSED', 'ARCHIVED'
  ) then
    raise exception 'Unsupported document status';
  end if;
  if length(coalesce(transition_note, '')) > 500 then
    raise exception 'Status note is too long';
  end if;

  select * into document_row
  from public.business_documents
  where id = target_document_id
  for update;
  if not found then raise exception 'Business document not found'; end if;

  allowed_transition := case document_row.document_status
    when 'DRAFT' then target_status in ('PENDING_APPROVAL', 'APPROVED', 'SENT', 'CONFIRMED', 'CANCELLED', 'ARCHIVED')
    when 'PENDING_APPROVAL' then target_status in ('APPROVED', 'CANCELLED', 'ARCHIVED')
    when 'APPROVED' then target_status in ('SENT', 'CONFIRMED', 'CANCELLED', 'ARCHIVED')
    when 'SENT' then target_status in ('CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', 'ARCHIVED')
    when 'CONFIRMED' then target_status in ('PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', 'ARCHIVED')
    when 'PARTIALLY_DELIVERED' then target_status in ('DELIVERED', 'CANCELLED', 'ARCHIVED')
    when 'DELIVERED' then target_status in ('REVERSED', 'ARCHIVED')
    when 'CANCELLED' then target_status in ('REVERSED', 'ARCHIVED')
    when 'REVERSED' then target_status = 'ARCHIVED'
    else false
  end;

  if not allowed_transition then
    raise exception 'Document cannot move from % to %', document_row.document_status, target_status;
  end if;

  perform set_config('app.business_document_note', coalesce(transition_note, ''), true);

  update public.business_documents
  set document_status = target_status,
      updated_by = actor_user_id
  where id = target_document_id
  returning * into document_row;

  return document_row;
end;
$$;

drop trigger if exists business_documents_assign_number on public.business_documents;
create trigger business_documents_assign_number
before insert on public.business_documents
for each row execute function public.assign_business_document_number();

drop trigger if exists business_documents_audit_insert on public.business_documents;
create trigger business_documents_audit_insert
after insert on public.business_documents
for each row execute function public.audit_business_document_change();

drop trigger if exists business_documents_audit_status on public.business_documents;
create trigger business_documents_audit_status
after update of document_status on public.business_documents
for each row execute function public.audit_business_document_change();

drop trigger if exists business_document_attachments_audit_insert on public.business_document_attachments;
create trigger business_document_attachments_audit_insert
after insert on public.business_document_attachments
for each row execute function public.audit_business_document_attachment();

drop trigger if exists business_document_settings_audit_change on public.business_document_settings;
create trigger business_document_settings_audit_change
after insert or update of template on public.business_document_settings
for each row execute function public.audit_business_document_settings_change();

revoke all on function public.assign_business_document_number() from public, anon, authenticated;
revoke all on function public.audit_business_document_change() from public, anon, authenticated;
revoke all on function public.audit_business_document_attachment() from public, anon, authenticated;
revoke all on function public.audit_business_document_settings_change() from public, anon, authenticated;
revoke all on function public.transition_business_document(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.transition_business_document(uuid, text, text, uuid) to service_role;
grant execute on function public.audit_business_document_settings_change() to service_role;