-- Phase C: supplier Available / Not available responses with the automatic
-- three-supplier confirmation threshold (BR-04..BR-06, FR-17..FR-20, AC-10..AC-12).

create function rpc_supplier_respond(p_cycle_id uuid, p_available boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cycle job_cycles%rowtype;
  v_job jobs%rowtype;
  v_row cycle_suppliers%rowtype;
  v_new response_status := case when p_available then 'available' else 'not_available' end::response_status;
  v_threshold int := coalesce((get_config('confirmation_threshold'))::int, 3);
  v_available_count int;
  v_contact record;
  v_time_label text;
begin
  -- Lock the cycle first so a racing third response and cutoff evaluation
  -- serialize on the same row (SEC-10, AC-26).
  select * into v_cycle from job_cycles where id = p_cycle_id for update;
  if not found then
    raise exception 'Invitation not found';
  end if;

  select cs.* into v_row
  from cycle_suppliers cs
  join supplier_companies sc on sc.id = cs.supplier_id
  where cs.cycle_id = p_cycle_id and sc.contact_user_id = auth.uid()
  for update;
  if not found then
    raise exception 'You are not invited to this visit';
  end if;

  if v_cycle.status = 'AWAITING_SUPPLIER_RESPONSES'
     and (v_cycle.response_cutoff is null or now() < v_cycle.response_cutoff) then
    null; -- responses are open and editable
  elsif v_cycle.status in ('CONFIRMED', 'VISIT_PENDING') and v_row.response_status = 'pending' then
    null; -- BR-06: after lock a pending supplier must still record a response
  else
    raise exception 'Responses are closed for this visit';
  end if;

  update cycle_suppliers
  set response_status = v_new, response_at = now()
  where id = v_row.id;

  perform write_audit('supplier_response', 'cycle_supplier', v_row.id,
    jsonb_build_object('previous', v_row.response_status),
    jsonb_build_object('response', v_new));

  -- Threshold check only while the cycle is still awaiting responses (BR-05).
  if p_available and v_cycle.status = 'AWAITING_SUPPLIER_RESPONSES' then
    select count(*) into v_available_count
    from cycle_suppliers
    where cycle_id = p_cycle_id and response_status = 'available';

    if v_available_count >= v_threshold then
      update job_cycles
      set status = 'CONFIRMED',
          confirmation_source = 'auto_threshold',
          confirmed_at = now(),
          updated_at = now()
      where id = p_cycle_id;

      -- The cutoff decision and supplier reminders are no longer needed.
      update reminder_schedule
      set status = 'cancelled'
      where cycle_id = p_cycle_id
        and reminder_type in ('response_cutoff', 'supplier_reminder')
        and status = 'scheduled';

      select * into v_job from jobs where id = v_cycle.job_id;
      v_time_label := to_char(v_cycle.selected_time at time zone 'Asia/Colombo', 'DD Mon YYYY HH24:MI');

      -- N-03: confirmed-time notice to every selected supplier (BR-06)
      for v_contact in
        select sc.contact_user_id
        from cycle_suppliers cs
        join supplier_companies sc on sc.id = cs.supplier_id
        where cs.cycle_id = p_cycle_id
      loop
        perform queue_notification(
          v_contact.contact_user_id, v_job.id, p_cycle_id, 'N-03',
          format('The visit time for PR %s is confirmed for %s. Attendance is required. Open the app and record your confirmation.',
                 v_job.pr_reference, v_time_label)
        );
      end loop;

      -- Engineer and Procurement are notified of the lock (FR-20)
      perform queue_notification(
        v_job.engineer_id, v_job.id, p_cycle_id, 'N-03',
        format('PR %s visit confirmed for %s. %s suppliers are available.', v_job.pr_reference, v_time_label, v_available_count)
      );
      perform queue_notification(
        v_job.created_by, v_job.id, p_cycle_id, 'N-03',
        format('PR %s visit confirmed for %s by automatic threshold.', v_job.pr_reference, v_time_label)
      );

      perform write_audit('threshold_confirmed', 'job_cycle', p_cycle_id, null,
        jsonb_build_object('available_count', v_available_count));

      return jsonb_build_object('response', v_new, 'cycle_status', 'CONFIRMED');
    end if;
  end if;

  return jsonb_build_object('response', v_new, 'cycle_status', v_cycle.status);
end $$;
