-- Timer worker: processes overdue deadlines and queues the matching SMS.
-- Called by a trusted script/cron with the service-role key (and usable by a
-- dashboard user for manual runs). For now it handles the Procurement closure
-- SLA escalation: a cycle sitting in AWAITING_PROCUREMENT_CLOSE past the SLA
-- pings the job's Procurement owner (repeating no more than once per interval).

create function rpc_run_timers() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_is_service boolean := coalesce((auth.jwt() ->> 'role'), '') = 'service_role';
  v_sla_days int := coalesce((get_config('procurement_closure_sla_days'))::int, 3);
  v_repeat_hours int := coalesce((get_config('manager_escalation_repeat_hours'))::int, 24);
  v_row record;
  v_days int;
  v_escalations int := 0;
begin
  if not (v_is_service or is_dashboard_user()) then
    raise exception 'Not authorized to run timers';
  end if;

  for v_row in
    select jc.id as cycle_id, jc.job_id, j.pr_reference, j.created_by, ec.closed_at
    from job_cycles jc
    join jobs j on j.id = jc.job_id
    join engineer_closures ec on ec.cycle_id = jc.id
    where jc.status = 'AWAITING_PROCUREMENT_CLOSE'
      and ec.closed_at + make_interval(days => v_sla_days) < now()
      and not exists (
        select 1 from notification_log nl
        where nl.cycle_id = jc.id
          and nl.message_type = 'N-08'
          and nl.created_at > now() - make_interval(hours => v_repeat_hours)
      )
  loop
    v_days := floor(extract(epoch from (now() - v_row.closed_at)) / 86400)::int;
    perform queue_notification(
      v_row.created_by, v_row.job_id, v_row.cycle_id, 'N-08',
      format('PR %s: the visit was closed %s day(s) ago and still awaits your final decision. Open Go See and Close, Recirculate, or Cancel.',
             v_row.pr_reference, v_days)
    );
    v_escalations := v_escalations + 1;
  end loop;

  return jsonb_build_object('procurement_sla_escalations', v_escalations);
end $$;
