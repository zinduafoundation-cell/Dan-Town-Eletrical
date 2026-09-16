create unique index if not exists automation_jobs_source_reference_unique
on public.automation_jobs (source, source_reference)
where source_reference is not null;

