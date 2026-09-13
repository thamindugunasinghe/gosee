-- Settings tab support + fix: procurement alerts (N-06 etc.) had no recipient
-- because dashboard users log in by email and often have no mobile. A configurable
-- procurement_notify_mobile provides the destination.

insert into system_config (key, value, description) values
  ('procurement_notify_mobile', '""',
   'Mobile number that receives Procurement close/recirculate SMS alerts (E.164 or local 07…)')
on conflict (key) do nothing;

-- Dashboard-only editing of any configuration value, with an audit trail.
create function rpc_update_config(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb;
begin
  if not is_dashboard_user() then
    raise exception 'Only Procurement or System Admin can change settings';
  end if;
  select value into v_old from system_config where key = p_key;
  if not found then
    raise exception 'Unknown setting: %', p_key;
  end if;

  update system_config
  set value = p_value, updated_by = auth.uid(), updated_at = now()
  where key = p_key;

  perform write_audit('config_updated', 'system_config', null,
    jsonb_build_object('key', p_key, 'value', v_old),
    jsonb_build_object('key', p_key, 'value', p_value));
end $$;

-- Normalize a Sri Lankan number to E.164, mirroring the app/dashboard helpers.
create function normalize_lk_mobile(p_raw text) returns text
language plpgsql immutable as $$
declare
  n text := regexp_replace(coalesce(p_raw, ''), '[^0-9]', '', 'g');
begin
  if n = '' then return null; end if;
  if left(n, 1) = '0' then n := '94' || substr(n, 2); end if;
  if left(n, 2) <> '94' then n := '94' || n; end if;
  return '+' || n;
end $$;

-- Route procurement-directed alerts to the configured number when the recipient
-- (a dashboard user) has no mobile of their own. Engineers/suppliers are unchanged.
create or replace function queue_notification(
  p_user_id uuid,
  p_job_id uuid,
  p_cycle_id uuid,
  p_message_type text,
  p_message text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_mobile text;
  v_role user_role;
  v_id uuid;
begin
  select mobile, role into v_mobile, v_role from profiles where id = p_user_id;

  if v_mobile is null and v_role in ('procurement', 'procurement_manager', 'system_admin') then
    v_mobile := normalize_lk_mobile(nullif(trim(both '"' from (get_config('procurement_notify_mobile'))::text), ''));
  end if;

  insert into notification_log (user_id, job_id, cycle_id, channel, message_type, recipient_mobile, message)
  values (p_user_id, p_job_id, p_cycle_id, 'sms', p_message_type, v_mobile, p_message)
  returning id into v_id;
  return v_id;
end $$;
