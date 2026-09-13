-- Phase B: engineer selects one visit time (SCH-01..04, FR-13..16)

-- Scheduling settings for the mobile timeline. Any signed-in user may read
-- these non-sensitive values (system_config itself stays dashboard-only).
create function rpc_scheduling_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'window_hours',        coalesce((select value from system_config where key = 'scheduling_window_hours'), '72')::int,
    'lead_time_hours',     coalesce((select value from system_config where key = 'min_lead_time_hours'), '24')::int,
    'slot_minutes',        coalesce((select value from system_config where key = 'slot_increment_minutes'), '30')::int,
    'working_days',        coalesce((select value from system_config where key = 'working_days'), '[1,2,3,4,5,6]'),
    'working_hours_start', coalesce((select value from system_config where key = 'working_hours_start'), '"08:00"'),
    'working_hours_end',   coalesce((select value from system_config where key = 'working_hours_end'), '"17:00"'),
    'cutoff_hours',        coalesce((select value from system_config where key = 'response_cutoff_hours'), '24')::int
  )
$$;

-- Existing supplier-visit suggestions for the engineer timeline (Section 7.2).
-- Returns only times and counts — never other job/PR details (privacy rule).
create function rpc_cycle_suggestions(p_cycle_id uuid) returns table (
  suggested_time timestamptz,
  kind text,          -- 'confirmed' | 'pending'
  supplier_count int
)
language sql stable security definer set search_path = public as $$
  select jc.selected_time,
         case when jc.status in ('CONFIRMED','VISIT_PENDING') then 'confirmed' else 'pending' end,
         count(distinct cs2.supplier_id)::int
  from cycle_suppliers cs
  join cycle_suppliers cs2 on cs2.supplier_id = cs.supplier_id and cs2.cycle_id <> cs.cycle_id
  join job_cycles jc on jc.id = cs2.cycle_id
  join job_cycles my on my.id = cs.cycle_id
  join jobs myjob on myjob.id = my.job_id
  where cs.cycle_id = p_cycle_id
    and myjob.engineer_id = auth.uid()
    and jc.selected_time is not null
    and jc.status in ('AWAITING_SUPPLIER_RESPONSES','CONFIRMED','VISIT_PENDING')
    and jc.selected_time > now()
  group by jc.selected_time, 2
  order by 2, jc.selected_time
$$;

create function rpc_select_time(p_cycle_id uuid, p_time timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cycle job_cycles%rowtype;
  v_job jobs%rowtype;
  v_cfg jsonb := rpc_scheduling_config();
  v_local timestamptz;
  v_local_time time;
  v_dow int;
  v_cutoff timestamptz;
  v_contact record;
  v_time_label text;
begin
  select * into v_cycle from job_cycles where id = p_cycle_id for update;
  if not found then
    raise exception 'Cycle not found';
  end if;
  select * into v_job from jobs where id = v_cycle.job_id;

  if v_job.engineer_id <> auth.uid() then
    raise exception 'Only the assigned engineer can select the visit time';
  end if;
  if v_cycle.status not in ('AWAITING_ENGINEER_TIME', 'RESCHEDULE_REQUIRED') then
    raise exception 'A time cannot be selected while the cycle is %', v_cycle.status;
  end if;

  -- SCH-01/02: minimum lead time and rolling window end
  if p_time < now() + make_interval(hours => (v_cfg->>'lead_time_hours')::int) then
    raise exception 'Selected time is inside the minimum lead time of % hours', v_cfg->>'lead_time_hours';
  end if;
  if p_time > now() + make_interval(hours => (v_cfg->>'window_hours')::int) then
    raise exception 'Selected time is beyond the % hour scheduling window', v_cfg->>'window_hours';
  end if;

  -- SCH-03: slot alignment
  if extract(second from p_time) <> 0
     or (extract(minute from p_time)::int % (v_cfg->>'slot_minutes')::int) <> 0 then
    raise exception 'Time must align to % minute slots', v_cfg->>'slot_minutes';
  end if;

  -- SCH-04: working days and hours (site local time)
  v_local_time := (p_time at time zone 'Asia/Colombo')::time;
  v_dow := extract(isodow from (p_time at time zone 'Asia/Colombo'))::int;
  if not (v_cfg->'working_days') @> to_jsonb(v_dow) then
    raise exception 'Selected day is outside site working days';
  end if;
  if v_local_time < ((v_cfg->>'working_hours_start')::time)
     or v_local_time >= ((v_cfg->>'working_hours_end')::time) then
    raise exception 'Selected time is outside site working hours (% - %)',
      v_cfg->>'working_hours_start', v_cfg->>'working_hours_end';
  end if;

  v_cutoff := p_time - make_interval(hours => (v_cfg->>'cutoff_hours')::int);

  update job_cycles
  set selected_time = p_time,
      response_cutoff = v_cutoff,
      status = 'AWAITING_SUPPLIER_RESPONSES',
      updated_at = now()
  where id = p_cycle_id;

  -- Reset responses for this attempt and stamp the invitation
  update cycle_suppliers
  set invited_at = now(), response_status = 'pending', response_at = null
  where cycle_id = p_cycle_id;

  v_time_label := to_char(p_time at time zone 'Asia/Colombo', 'DD Mon YYYY HH24:MI');

  -- N-02 supplier invitations
  for v_contact in
    select sc.contact_user_id
    from cycle_suppliers cs
    join supplier_companies sc on sc.id = cs.supplier_id
    where cs.cycle_id = p_cycle_id
  loop
    perform queue_notification(
      v_contact.contact_user_id, v_job.id, p_cycle_id, 'N-02',
      format('PR %s - Engineer selected %s. Open Go See and confirm Available or Not available.',
             v_job.pr_reference, v_time_label)
    );
  end loop;

  -- Timer catalogue: cutoff decision + supplier reminders (idempotent per attempt)
  insert into reminder_schedule (cycle_id, reminder_type, due_at, status, idempotency_key)
  values
    (p_cycle_id, 'response_cutoff', v_cutoff, 'scheduled',
     p_cycle_id || ':cutoff:' || extract(epoch from p_time)::bigint)
  on conflict (idempotency_key) do nothing;

  insert into reminder_schedule (cycle_id, reminder_type, due_at, status, idempotency_key)
  select p_cycle_id, 'supplier_reminder', due, 'scheduled',
         p_cycle_id || ':srem:' || extract(epoch from due)::bigint
  from (values
    (now() + make_interval(hours => coalesce((get_config('supplier_reminder_after_invite_hours'))::int, 6))),
    (v_cutoff - make_interval(hours => coalesce((get_config('supplier_reminder_before_cutoff_hours'))::int, 2)))
  ) as t(due)
  where due > now() and due < v_cutoff
  on conflict (idempotency_key) do nothing;

  perform write_audit('time_selected', 'job_cycle', p_cycle_id, null,
    jsonb_build_object('selected_time', p_time, 'response_cutoff', v_cutoff));

  return jsonb_build_object('selected_time', p_time, 'response_cutoff', v_cutoff);
end $$;
