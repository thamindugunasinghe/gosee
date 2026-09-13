-- Phase E: procurement final closure - close, recirculate, or cancel (FR-27..FR-31, Section 8.5).

create function rpc_procurement_close(
  p_cycle_id uuid,
  p_action procurement_action,
  p_reason text default null,
  p_supplier_ids uuid[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cycle job_cycles%rowtype;
  v_job jobs%rowtype;
  v_new_cycle_id uuid;
  v_new_cycle_no int;
  v_sid uuid;
begin
  if not is_dashboard_user() then
    raise exception 'Only Procurement can perform final closure';
  end if;

  select * into v_cycle from job_cycles where id = p_cycle_id for update;
  if not found then
    raise exception 'Cycle not found';
  end if;
  if v_cycle.status <> 'AWAITING_PROCUREMENT_CLOSE' then
    raise exception 'Final closure is only possible while the cycle is awaiting procurement close (current: %)', v_cycle.status;
  end if;
  select * into v_job from jobs where id = v_cycle.job_id for update;

  -- The table constraint additionally enforces a reason for recirculate/cancel.
  insert into procurement_closures (job_id, cycle_id, action, reason, closed_by)
  values (v_job.id, p_cycle_id, p_action, nullif(trim(coalesce(p_reason, '')), ''), auth.uid());

  if p_action = 'close' then
    update job_cycles set status = 'CLOSED', updated_at = now() where id = p_cycle_id;
    update jobs set status = 'closed' where id = v_job.id;
    perform queue_notification(
      v_job.engineer_id, v_job.id, p_cycle_id, 'N-07',
      format('PR %s has been closed by Procurement. Thank you.', v_job.pr_reference)
    );

  elsif p_action = 'cancel' then
    update job_cycles set status = 'CANCELLED', updated_at = now() where id = p_cycle_id;
    update jobs set status = 'cancelled' where id = v_job.id;
    perform queue_notification(
      v_job.engineer_id, v_job.id, p_cycle_id, 'N-07',
      format('PR %s has been cancelled by Procurement. Reason: %s', v_job.pr_reference, p_reason)
    );

  else -- recirculate
    if coalesce(array_length(p_supplier_ids, 1), 0) < 1 then
      raise exception 'Select at least one supplier for the new cycle';
    end if;

    update job_cycles set status = 'RECIRCULATED', updated_at = now() where id = p_cycle_id;

    v_new_cycle_no := v_cycle.cycle_no + 1;
    insert into job_cycles (job_id, cycle_no, status)
    values (v_job.id, v_new_cycle_no, 'AWAITING_ENGINEER_TIME')
    returning id into v_new_cycle_id;

    -- BR-12: the insert trigger rejects any supplier who attended an earlier cycle.
    foreach v_sid in array p_supplier_ids loop
      insert into cycle_suppliers (cycle_id, supplier_id) values (v_new_cycle_id, v_sid);
    end loop;

    perform queue_notification(
      v_job.engineer_id, v_job.id, v_new_cycle_id, 'N-01',
      format('PR %s has been recirculated (cycle R%s). Open the app and select one visit time.',
             v_job.pr_reference, v_new_cycle_no)
    );

    perform write_audit('cycle_recirculated', 'job_cycle', v_new_cycle_id, null,
      jsonb_build_object('previous_cycle', p_cycle_id, 'supplier_count', array_length(p_supplier_ids, 1)));
  end if;

  perform write_audit('procurement_closure', 'job_cycle', p_cycle_id, null,
    jsonb_build_object('action', p_action, 'reason', p_reason));

  return jsonb_build_object('action', p_action, 'new_cycle_id', v_new_cycle_id);
end $$;
