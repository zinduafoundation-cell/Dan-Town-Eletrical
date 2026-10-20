do $$
declare
  function_definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.complete_pos_paystack_payment(uuid, text, integer, jsonb)'::regprocedure
  )
  into function_definition;

  if position('existing_transaction public.payment_transactions;' in function_definition) = 0
     or position(
       'select * into existing_transaction from public.payment_transactions where payment_transactions.provider_reference = target_provider_reference limit 1;'
       in function_definition
     ) = 0
     or position('if found then return target_order; end if;' in function_definition) = 0 then
    raise exception 'Could not find expected payment idempotency check';
  end if;

  updated_definition := replace(
    function_definition,
    '  existing_transaction public.payment_transactions;',
    ''
  );
  updated_definition := replace(
    updated_definition,
    'select * into existing_transaction from public.payment_transactions where payment_transactions.provider_reference = target_provider_reference limit 1;',
    'if exists (select 1 from public.payment_transactions where payment_transactions.provider_reference = target_provider_reference) then
    return target_order;
  end if;'
  );
  updated_definition := replace(
    updated_definition,
    'if found then return target_order; end if;',
    ''
  );
  if updated_definition = function_definition then
    raise exception 'Could not update payment idempotency check';
  end if;
  execute updated_definition;

  select pg_get_functiondef(
    'public.archive_and_delete_order(uuid, uuid, text, jsonb)'::regprocedure
  )
  into function_definition;

  if position('v_locked_order_id uuid;' in function_definition) = 0
     or position(
       'select id into v_locked_order_id
  from public.orders
  where id = p_order_id
  for update;' in function_definition
     ) = 0 then
    raise exception 'Could not find expected order lock';
  end if;

  updated_definition := replace(
    function_definition,
    '  v_locked_order_id uuid;',
    ''
  );
  updated_definition := replace(
    updated_definition,
    '  select id into v_locked_order_id
  from public.orders
  where id = p_order_id
  for update;',
    '  perform 1
  from public.orders
  where id = p_order_id
  for update;'
  );
  if updated_definition = function_definition then
    raise exception 'Could not preserve order lock while removing unused variable';
  end if;
  execute updated_definition;
end;
$$;
