alter table public.business_document_events
  drop constraint if exists business_document_events_event_type_check;

alter table public.business_document_events
  add constraint business_document_events_event_type_check
  check (event_type in ('CREATED', 'STATUS_CHANGED', 'CONTENT_UPDATED', 'ATTACHMENT_ADDED'));

create or replace function public.audit_business_document_content_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  changed_fields text[];
begin
  if (
    new.document_title,
    new.counterparty_type,
    new.customer_name,
    new.customer_contact,
    new.tax_pin,
    new.due_date,
    new.payment_method,
    new.payment_terms,
    new.line_items,
    new.subtotal,
    new.discount,
    new.tax,
    new.total,
    new.notes,
    new.terms_and_conditions,
    new.prepared_by,
    new.checked_by,
    new.approved_by
  ) is distinct from (
    old.document_title,
    old.counterparty_type,
    old.customer_name,
    old.customer_contact,
    old.tax_pin,
    old.due_date,
    old.payment_method,
    old.payment_terms,
    old.line_items,
    old.subtotal,
    old.discount,
    old.tax,
    old.total,
    old.notes,
    old.terms_and_conditions,
    old.prepared_by,
    old.checked_by,
    old.approved_by
  ) then
    changed_fields := array_remove(array[
      case when new.document_title is distinct from old.document_title then 'document title' end,
      case when new.counterparty_type is distinct from old.counterparty_type then 'party type' end,
      case when new.customer_name is distinct from old.customer_name then 'party name' end,
      case when new.customer_contact is distinct from old.customer_contact then 'party contact' end,
      case when new.tax_pin is distinct from old.tax_pin then 'tax PIN' end,
      case when new.due_date is distinct from old.due_date then 'due date' end,
      case when new.payment_method is distinct from old.payment_method then 'payment method' end,
      case when new.payment_terms is distinct from old.payment_terms then 'payment terms' end,
      case when new.line_items is distinct from old.line_items then 'line items' end,
      case when new.subtotal is distinct from old.subtotal then 'subtotal' end,
      case when new.discount is distinct from old.discount then 'discount' end,
      case when new.tax is distinct from old.tax then 'tax' end,
      case when new.total is distinct from old.total then 'total' end,
      case when new.notes is distinct from old.notes then 'notes' end,
      case when new.terms_and_conditions is distinct from old.terms_and_conditions then 'terms and conditions' end,
      case when new.prepared_by is distinct from old.prepared_by then 'prepared by' end,
      case when new.checked_by is distinct from old.checked_by then 'checked by' end,
      case when new.approved_by is distinct from old.approved_by then 'approved by' end
    ], null);
    insert into public.business_document_events (
      business_document_id, event_type, previous_status, new_status, note, actor_id
    ) values (
      new.id, 'CONTENT_UPDATED', new.document_status, new.document_status,
      'Draft content updated: ' || array_to_string(changed_fields, ', '), new.updated_by
    );
  end if;
  return new;
end;
$$;

drop trigger if exists business_documents_audit_content_update on public.business_documents;
create trigger business_documents_audit_content_update
after update of document_title, counterparty_type, customer_name, customer_contact, tax_pin,
  due_date, payment_method, payment_terms, line_items, subtotal, discount, tax, total,
  notes, terms_and_conditions, prepared_by, checked_by, approved_by
on public.business_documents
for each row execute function public.audit_business_document_content_change();

create or replace function public.update_business_document_draft(
  target_document_id uuid,
  document_data jsonb,
  actor_user_id uuid
)
returns public.business_documents
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  document_row public.business_documents;
  line_rows jsonb;
  subtotal_amount numeric(12, 2);
  discount_amount numeric(12, 2);
  tax_amount numeric(12, 2);
  total_amount numeric(12, 2);
begin
  if document_data is null or jsonb_typeof(document_data) <> 'object' then
    raise exception 'Document details are invalid';
  end if;
  select * into document_row
  from public.business_documents
  where id = target_document_id
  for update;
  if not found then raise exception 'Business document not found'; end if;
  if document_row.document_status <> 'DRAFT' then
    raise exception 'Only draft business documents can be edited';
  end if;

  if jsonb_typeof(document_data->'lineItems') is distinct from 'array' then
    raise exception 'Document line items are invalid';
  end if;
  if jsonb_array_length(document_data->'lineItems') > 100 then
    raise exception 'Document line items are invalid';
  end if;
  if jsonb_array_length(document_data->'lineItems') > 0 and exists (
    select 1
    from jsonb_to_recordset(document_data->'lineItems') as item(name text, sku text, quantity numeric, "unitPrice" numeric)
    where item.name is null or length(btrim(item.name)) not between 1 and 160
      or item.quantity is null or item.quantity <= 0 or item.quantity > 100000
      or item."unitPrice" is null or item."unitPrice" < 0 or item."unitPrice" > 100000000
  ) then
    raise exception 'Document line items are invalid';
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'name', item.name,
      'sku', item.sku,
      'quantity', item.quantity,
      'unit_price', item."unitPrice",
      'total', round(item.quantity * item."unitPrice", 2)
    ) order by item.ordinality), '[]'::jsonb),
    coalesce(round(sum(round(item.quantity * item."unitPrice", 2)), 2), 0)
  into line_rows, subtotal_amount
  from jsonb_to_recordset(document_data->'lineItems') with ordinality
    as item(name text, sku text, quantity numeric, "unitPrice" numeric, ordinality bigint);

  discount_amount := coalesce((document_data->>'discount')::numeric, 0);
  tax_amount := coalesce((document_data->>'tax')::numeric, 0);
  if discount_amount < 0 or tax_amount < 0 or discount_amount > subtotal_amount
     or discount_amount > 100000000 or tax_amount > 100000000 then
    raise exception 'Document amounts are invalid';
  end if;
  total_amount := round(subtotal_amount - discount_amount + tax_amount, 2);
  if total_amount < 0 or total_amount > 999999999.99 then
    raise exception 'Document total is above the supported limit';
  end if;

  update public.business_documents
  set document_title = nullif(document_data->>'documentTitle', ''),
      counterparty_type = document_data->>'counterpartyType',
      customer_name = nullif(document_data->>'customerName', ''),
      customer_contact = nullif(document_data->>'customerContact', ''),
      tax_pin = nullif(document_data->>'taxPin', ''),
      due_date = nullif(document_data->>'dueDate', '')::date,
      payment_method = nullif(document_data->>'paymentMethod', ''),
      payment_terms = nullif(document_data->>'paymentTerms', ''),
      line_items = line_rows,
      subtotal = subtotal_amount,
      discount = discount_amount,
      tax = tax_amount,
      total = total_amount,
      notes = coalesce(document_data->>'notes', ''),
      terms_and_conditions = coalesce(document_data->>'termsAndConditions', ''),
      prepared_by = nullif(document_data->>'preparedBy', ''),
      checked_by = nullif(document_data->>'checkedBy', ''),
      approved_by = nullif(document_data->>'approvedBy', ''),
      updated_by = actor_user_id
  where id = target_document_id
  returning * into document_row;
  return document_row;
end;
$$;

revoke all on function public.audit_business_document_content_change() from public, anon, authenticated;
revoke all on function public.update_business_document_draft(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.audit_business_document_content_change() to service_role;
grant execute on function public.update_business_document_draft(uuid, jsonb, uuid) to service_role;