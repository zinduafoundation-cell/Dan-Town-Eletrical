do $$ begin
  create type public.automation_job_status as enum ('RECEIVED', 'PROCESSING', 'COMPLETED', 'PROCESSING_FAILED', 'REQUIRES_REVIEW');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.product_match_status as enum ('MATCHED', 'POSSIBLE_MATCH', 'NEW_PRODUCT');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.pricing_approval_status as enum ('PENDING', 'AI_RECOMMENDED', 'AUTO_APPROVED', 'REQUIRES_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.price_source as enum ('MANUAL', 'AI', 'SUPPLIER_UPDATE', 'PROMOTION', 'MARKET_UPDATE');
exception when duplicate_object then null;
end $$;

create table if not exists public.automation_jobs (
  id uuid primary key default gen_random_uuid(), workflow_name text not null, status public.automation_job_status not null default 'RECEIVED', source text not null, source_reference text, payload jsonb not null default '{}'::jsonb, error_message text, retry_count integer not null default 0 check (retry_count >= 0), next_retry_at timestamptz, dead_letter boolean not null default false, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), completed_at timestamptz
);
create table if not exists public.supplier_documents (
  id uuid primary key default gen_random_uuid(), automation_job_id uuid references public.automation_jobs(id) on delete set null, supplier_id uuid references public.suppliers(id) on delete set null, source_type text not null, storage_path text, file_name text, content_type text, source_metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.extraction_runs (
  id uuid primary key default gen_random_uuid(), supplier_document_id uuid not null references public.supplier_documents(id) on delete cascade, status public.automation_job_status not null default 'PROCESSING', extractor text not null, normalized_payload jsonb, confidence numeric(5,4) check (confidence between 0 and 1), error_message text, created_at timestamptz not null default timezone('utc', now()), completed_at timestamptz
);
create table if not exists public.product_matches (
  id uuid primary key default gen_random_uuid(), automation_job_id uuid references public.automation_jobs(id) on delete set null, product_id uuid references public.products(id) on delete set null, supplier_id uuid references public.suppliers(id) on delete set null, supplier_sku text, source_name text not null, normalized_name text not null, match_status public.product_match_status not null, confidence numeric(5,4) not null check (confidence between 0 and 1), match_reasons jsonb not null default '[]'::jsonb, reviewed_by uuid references auth.users(id) on delete set null, reviewed_at timestamptz, created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.product_drafts (
  id uuid primary key default gen_random_uuid(), product_match_id uuid references public.product_matches(id) on delete set null, supplier_id uuid references public.suppliers(id) on delete set null, name text not null, brand text, category text, description text, supplier_sku text, cost numeric(12,2) check (cost >= 0), quantity integer check (quantity >= 0), specifications jsonb not null default '{}'::jsonb, images jsonb not null default '[]'::jsonb, status public.pricing_approval_status not null default 'REQUIRES_REVIEW', reviewed_by uuid references auth.users(id), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.landed_cost_calculations (
  id uuid primary key default gen_random_uuid(), product_id uuid references public.products(id) on delete set null, supplier_id uuid references public.suppliers(id) on delete set null, automation_job_id uuid references public.automation_jobs(id) on delete set null, unit_cost numeric(12,2) not null check (unit_cost >= 0), allocated_transport numeric(12,2) not null default 0 check (allocated_transport >= 0), other_costs numeric(12,2) not null default 0 check (other_costs >= 0), supplier_discount numeric(12,2) not null default 0 check (supplier_discount >= 0), tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0), tax_included boolean not null default false, landed_cost numeric(12,2) not null check (landed_cost >= 0), currency char(3) not null default 'KES', inputs jsonb not null default '{}'::jsonb, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(), name text not null, customer_segment public.customer_type, minimum_margin numeric(5,2) not null default 0 check (minimum_margin between 0 and 100), maximum_discount numeric(5,2) not null default 0 check (maximum_discount between 0 and 100), vat_rate numeric(5,2) not null default 16 check (vat_rate between 0 and 100), rounding_increment numeric(12,2) not null default 1 check (rounding_increment > 0), promotional_limit numeric(5,2) not null default 0 check (promotional_limit between 0 and 100), is_active boolean not null default true, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.pricing_recommendations (
  id uuid primary key default gen_random_uuid(), product_id uuid references public.products(id) on delete set null, landed_cost_calculation_id uuid references public.landed_cost_calculations(id) on delete set null, pricing_rule_id uuid references public.pricing_rules(id) on delete set null, agent text not null default 'deterministic', retail_price numeric(12,2) not null check (retail_price >= 0), contractor_price numeric(12,2) not null check (contractor_price >= 0), dealer_price numeric(12,2) not null check (dealer_price >= 0), wholesale_price numeric(12,2) not null check (wholesale_price >= 0), promotional_price numeric(12,2) not null check (promotional_price >= 0), minimum_allowed_price numeric(12,2) not null check (minimum_allowed_price >= 0), maximum_suggested_price numeric(12,2) not null check (maximum_suggested_price >= 0), reasoning_summary text not null, confidence numeric(5,4) not null check (confidence between 0 and 1), rules_passed boolean not null default false, status public.pricing_approval_status not null default 'AI_RECOMMENDED', created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.pricing_approvals (
  id uuid primary key default gen_random_uuid(), recommendation_id uuid not null references public.pricing_recommendations(id) on delete cascade, status public.pricing_approval_status not null default 'PENDING', submitted_by uuid references auth.users(id), reviewed_by uuid references auth.users(id), review_note text, created_at timestamptz not null default timezone('utc', now()), reviewed_at timestamptz
);
create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete restrict, price_type text not null, old_price numeric(12,2), new_price numeric(12,2) not null check (new_price >= 0), reason text not null, source public.price_source not null, recommendation_id uuid references public.pricing_recommendations(id) on delete set null, approved_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default timezone('utc', now())
);
-- Trigger will be added below
-- Trigger will be added below
create trigger automation_jobs_updated_at before update on public.automation_jobs for each row execute function public.set_updated_at();
-- Trigger will be added below
-- Trigger will be added below
create trigger drafts_updated_at before update on public.product_drafts for each row execute function public.set_updated_at();
-- Trigger will be added below
-- Trigger will be added below
create trigger pricing_rules_updated_at before update on public.pricing_rules for each row execute function public.set_updated_at();
create index automation_jobs_status_idx on public.automation_jobs(status, created_at); create index supplier_documents_supplier_idx on public.supplier_documents(supplier_id); create index extraction_runs_document_idx on public.extraction_runs(supplier_document_id); create index product_matches_status_idx on public.product_matches(match_status, confidence); create index drafts_status_idx on public.product_drafts(status); create index landed_cost_product_idx on public.landed_cost_calculations(product_id, created_at); create index pricing_recommendations_status_idx on public.pricing_recommendations(status); create index price_history_product_idx on public.price_history(product_id, created_at desc);

alter table public.automation_jobs enable row level security; alter table public.supplier_documents enable row level security; alter table public.extraction_runs enable row level security; alter table public.product_matches enable row level security; alter table public.product_drafts enable row level security; alter table public.landed_cost_calculations enable row level security; alter table public.pricing_rules enable row level security; alter table public.pricing_recommendations enable row level security; alter table public.pricing_approvals enable row level security; alter table public.price_history enable row level security;
drop policy if exists "authorized staff read automation jobs" on public.automation_jobs;
drop policy if exists "authorized staff read automation jobs" on public.automation_jobs;
create policy "authorized staff read automation jobs" on public.automation_jobs for select using (public.has_permission('automation.read'));
drop policy if exists "authorized staff manage automation" on public.automation_jobs;
drop policy if exists "authorized staff manage automation" on public.automation_jobs;
create policy "authorized staff manage automation" on public.automation_jobs for all using (public.has_permission('automation.manage')) with check (public.has_permission('automation.manage'));
drop policy if exists "authorized staff read automation artifacts" on public.supplier_documents;
drop policy if exists "authorized staff read automation artifacts" on public.supplier_documents;
create policy "authorized staff read automation artifacts" on public.supplier_documents for select using (public.has_permission('automation.read')); drop policy if exists "authorized staff read extraction runs" on public.extraction_runs;
drop policy if exists "authorized staff read extraction runs" on public.extraction_runs;
create policy "authorized staff read extraction runs" on public.extraction_runs for select using (public.has_permission('automation.read')); drop policy if exists "authorized staff manage matches" on public.product_matches;
drop policy if exists "authorized staff manage matches" on public.product_matches;
create policy "authorized staff manage matches" on public.product_matches for all using (public.has_permission('automation.manage')) with check (public.has_permission('automation.manage')); drop policy if exists "authorized staff manage drafts" on public.product_drafts;
drop policy if exists "authorized staff manage drafts" on public.product_drafts;
create policy "authorized staff manage drafts" on public.product_drafts for all using (public.has_permission('products.create')) with check (public.has_permission('products.create')); drop policy if exists "authorized staff read landed costs" on public.landed_cost_calculations;
drop policy if exists "authorized staff read landed costs" on public.landed_cost_calculations;
create policy "authorized staff read landed costs" on public.landed_cost_calculations for select using (public.has_permission('finance.read') or public.has_permission('automation.read')); drop policy if exists "authorized staff manage pricing rules" on public.pricing_rules;
drop policy if exists "authorized staff manage pricing rules" on public.pricing_rules;
create policy "authorized staff manage pricing rules" on public.pricing_rules for all using (public.has_permission('pricing.manage')) with check (public.has_permission('pricing.manage')); drop policy if exists "authorized staff read recommendations" on public.pricing_recommendations;
drop policy if exists "authorized staff read recommendations" on public.pricing_recommendations;
create policy "authorized staff read recommendations" on public.pricing_recommendations for select using (public.has_permission('pricing.read')); drop policy if exists "authorized staff manage approvals" on public.pricing_approvals;
drop policy if exists "authorized staff manage approvals" on public.pricing_approvals;
create policy "authorized staff manage approvals" on public.pricing_approvals for all using (public.has_permission('pricing.approve')) with check (public.has_permission('pricing.approve')); drop policy if exists "authorized staff read price history" on public.price_history;
drop policy if exists "authorized staff read price history" on public.price_history;
create policy "authorized staff read price history" on public.price_history for select using (public.has_permission('pricing.read'));

