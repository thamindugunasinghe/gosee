-- Phase D (engineer side): close the visit after it happened (FR-23..FR-26).
-- The engineer records whether the visit took place and which suppliers attended;
-- the cycle then moves to Procurement for final closure.

create function rpc_close_visit(
  p_cycle_id uuid,
  p_visit_happened boolean,
  p_attended_supplier_ids uuid[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cycle job_cycles%rowtype;
  v_job jobs%rowtype;
  v_attended int := 0;
begin
  select * into v_cycle from job_cycles where id = p_cycle_id for update;
  if not found then
    raise exception 'Cycle not found';
  end if;
  select * into v_job from jobs where id = v_cycle.job_id;

  if v_job.engineer_id <> auth.uid() then
    raise exception 'Only the assigned engineer can close this visit';
  end if;
  if v_cycle.status not in ('CONFIRMED', 'VISIT_PENDING', 'AWAITING_ENGINEER_CLOSE') then
    raise exception 'This visit cannot be closed while the cycle is %', v_cycle.status;
  end if;
  if v_cycle.selected_time is null or now() < v_cycle.selected_time then
    raise exception 'The visit has not started yet - it can be closed after the selected time';
  end if;

  if p_visit_happened then
    update cycle_suppliers
    set attendance_status = case
      when supplier_id = any (p_attended_supplier_ids) then 'attended'::attendance_status
      else 'did_not_attend'::attendance_status
    end
    where cycle_id = p_cycle_id;
    select count(*) into v_attended
    from cycle_suppliers
    where cycle_id = p_cycle_id and attendance_status = 'attended';
  end if;

  insert into engineer_closures (cycle_id, visit_happened, closed_by)
  values (p_cycle_id, p_visit_happened, auth.uid());

  update job_cycles
  set status = 'AWAITING_PROCUREMENT_CLOSE', updated_at = now()
  where id = p_cycle_id;

  perform queue_notification(
    v_job.created_by, v_job.id, p_cycle_id, 'N-06',
    format('PR %s - Engineer closed the visit (%s, %s suppliers attended). Final closure is pending in the dashboard.',
           v_job.pr_reference,
           case when p_visit_happened then 'visit happened' else 'visit did not happen' end,
           v_attended)
  );

  perform write_audit('visit_closed', 'job_cycle', p_cycle_id, null,
    jsonb_build_object('visit_happened', p_visit_happened, 'attended_count', v_attended));

  return jsonb_build_object('cycle_status', 'AWAITING_PROCUREMENT_CLOSE', 'attended_count', v_attended);
end $$;
