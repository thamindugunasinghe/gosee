-- GoSee — transactional RPCs. All state changes flow through these
-- security-definer functions so RLS clients never write state tables directly.

-- Queue an SMS + app notification for a user. Delivery is performed by the
-- send-sms edge function which polls status = 'queued'.
create function queue_notification(
  p_user_id uuid,
  p_job_id uuid,
  p_cycle_id uuid,
  p_message_type text,
  p_message text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_mobile text;
  v_id uuid;
begin
  select mobile into v_mobile from profiles where id = p_user_id;
  insert into notification_log (user_id, job_id, cycle_id, channel, message_type, recipient_mobile, message)
  values (p_user_id, p_job_id, p_cycle_id, 'sms', p_message_type, v_mobile, p_message)
  returning id into v_id;
  return v_id;
end $$;

create function write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_old jsonb default null,
  p_new jsonb default null
) returns void
language sql security definer set search_path = public as $$
  insert into audit_log (actor_id, action, entity_type, entity_id, old_value, new_value)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_old, p_new)
$$;

create function get_config(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from system_config where key = p_key
$$;

-- ---------------------------------------------------------------- Phase A: job creation (FR-07..FR-12)

create function rpc_create_job(
  p_pr_reference text,
  p_description text,
  p_title text,
  p_engineer_id uuid,
  p_location text,
  p_priority job_priority,
  p_main_category_id uuid,
  p_sub_category_id uuid,
  p_supplier_ids uuid[],
  p_expected_requirement text default null,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_job_id uuid;
  v_cycle_id uuid;
  v_supplier_id uuid;
  v_active_suppliers int;
  v_min_suppliers int;
begin
  if auth_role() not in ('procurement', 'system_admin') then
    raise exception 'Only Procurement can create jobs';
  end if;

  if length(trim(coalesce(p_pr_reference, ''))) = 0 then
    raise exception 'PR number is required';
  end if;
  if length(trim(coalesce(p_description, ''))) = 0 then
    raise exception 'PR description is required';
  end if;

  if not exists (
    select 1 from profiles
    where id = p_engineer_id and role = 'engineer' and status = 'active'
  ) then
    raise exception 'Assigned engineer must be an active engineer';
  end if;

  if p_supplier_ids is null or array_length(p_supplier_ids, 1) is null then
    raise exception 'At least one supplier must be selected';
  end if;

  select count(*) into v_active_suppliers
  from supplier_companies
  where id = any (p_supplier_ids) and status = 'active';
  if v_active_suppliers <> array_length(p_supplier_ids, 1) then
    raise exception 'All selected suppliers must exist and be active';
  end if;

  -- Section 12: warn below minimum handled in UI; hard floor of 1 enforced here.
  v_min_suppliers := coalesce((get_config('min_suppliers_invited'))::int, 3);

  insert into jobs (
    pr_reference, description, title, engineer_id, location, priority,
    main_category_id, sub_category_id, expected_requirement, notes, created_by
  ) values (
    trim(p_pr_reference), trim(p_description), nullif(trim(coalesce(p_title, '')), ''),
    p_engineer_id, p_location, p_priority,
    p_main_category_id, p_sub_category_id, p_expected_requirement, p_notes, auth.uid()
  ) returning id into v_job_id;

  insert into job_cycles (job_id, cycle_no, status)
  values (v_job_id, 0, 'AWAITING_ENGINEER_TIME')
  returning id into v_cycle_id;

  foreach v_supplier_id in array p_supplier_ids loop
    insert into cycle_suppliers (cycle_id, supplier_id) values (v_cycle_id, v_supplier_id);
  end loop;

  -- N-01: engineer must select a visit time
  perform queue_notification(
    p_engineer_id, v_job_id, v_cycle_id, 'N-01',
    format('PR %s has been created in Go See. Open the app and select one visit time.', trim(p_pr_reference))
  );

  perform write_audit('job_created', 'job', v_job_id, null,
    jsonb_build_object(
      'pr_reference', p_pr_reference,
      'engineer_id', p_engineer_id,
      'supplier_count', array_length(p_supplier_ids, 1),
      'below_min_suppliers', array_length(p_supplier_ids, 1) < v_min_suppliers
    ));

  return v_job_id;
end $$;

-- Searchable active-engineer lookup for job creation (FR-08)
create function rpc_search_engineers(p_query text) returns table (
  id uuid, name text, department text, designation text
)
language sql stable security definer set search_path = public as $$
  select id, name, department, designation
  from profiles
  where role = 'engineer'
    and status = 'active'
    and (p_query is null or p_query = '' or name ilike '%' || p_query || '%')
    and is_dashboard_user()
  order by name
  limit 20
$$;
