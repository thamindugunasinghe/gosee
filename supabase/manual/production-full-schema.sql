-- ============================================================================
-- GoSee — FULL production schema (all 12 migrations, in order).
-- Run this ONCE in the NEW production project's SQL Editor if you can't use
-- 'supabase db push' (blocked DB port / keychain). Safe on a fresh, empty DB.
-- It also seeds the migration-history table so future 'supabase db push' stays
-- in sync. Do NOT run against a database that already has these objects.
-- ============================================================================

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);

-- ===================== 20260717000001_schema.sql =====================
-- GoSee v3.0 — core schema (Section 14 of requirement analysis)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums

create type user_role as enum (
  'procurement', 'procurement_manager', 'engineer', 'supplier_contact', 'system_admin'
);

create type record_status as enum ('active', 'inactive');

create type job_priority as enum ('normal', 'urgent');

create type job_status as enum ('active', 'closed', 'cancelled');

-- Section 7.6 cycle status model
create type cycle_status as enum (
  'DRAFT',
  'AWAITING_ENGINEER_TIME',
  'AWAITING_SUPPLIER_RESPONSES',
  'OVERRIDE_REQUIRED',
  'RESCHEDULE_REQUIRED',
  'CONFIRMED',
  'VISIT_PENDING',
  'AWAITING_ENGINEER_CLOSE',
  'AWAITING_PROCUREMENT_CLOSE',
  'RECIRCULATED',
  'CLOSED',
  'CANCELLED'
);

create type response_status as enum ('pending', 'available', 'not_available', 'no_response');

create type attendance_status as enum ('not_marked', 'attended', 'did_not_attend');

create type confirmation_source as enum ('auto_threshold', 'procurement_override');

create type override_decision_type as enum ('proceed', 'reschedule');

create type procurement_action as enum ('close', 'recirculate', 'cancel');

create type notification_channel as enum ('sms', 'app');

create type notification_status as enum ('queued', 'sent', 'delivered', 'failed');

create type reminder_status as enum ('scheduled', 'done', 'cancelled', 'failed');

-- ---------------------------------------------------------------- master data

-- Base person record for every role (engineer, supplier contact, procurement, admin).
-- id mirrors auth.users.id: dashboard creates the auth user (email or phone) first.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  mobile text unique,
  email text,
  role user_role not null,
  department text,
  designation text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'si', 'ta')),
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_required_for_otp_roles
    check (role not in ('engineer', 'supplier_contact') or mobile is not null)
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status record_status not null default 'active',
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create unique index categories_name_key on categories (lower(name));

-- Sub-category / spend tier (Low-Value, Standard, High-Value ...)
create table sub_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rank int not null default 0,
  status record_status not null default 'active',
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create unique index sub_categories_name_key on sub_categories (lower(name));

create table supplier_companies (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_user_id uuid not null references profiles (id),
  tier_id uuid not null references sub_categories (id),
  address text,
  availability_contact text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index supplier_companies_name_key on supplier_companies (lower(company_name));

create table supplier_categories (
  supplier_id uuid not null references supplier_companies (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  primary key (supplier_id, category_id)
);

-- ---------------------------------------------------------------- jobs and cycles

create table jobs (
  id uuid primary key default gen_random_uuid(),
  pr_reference text not null,
  description text not null,
  title text,
  engineer_id uuid not null references profiles (id),
  location text not null,
  priority job_priority not null default 'normal',
  main_category_id uuid references categories (id),
  sub_category_id uuid references sub_categories (id),
  expected_requirement text,
  notes text,
  status job_status not null default 'active',
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);
-- PR number searchable, preferably unique per active job (Section 8.4)
create unique index jobs_active_pr_key on jobs (lower(pr_reference)) where status = 'active';

create table job_cycles (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs (id) on delete cascade,
  cycle_no int not null default 0,
  selected_time timestamptz,
  response_cutoff timestamptz,
  status cycle_status not null default 'AWAITING_ENGINEER_TIME',
  confirmation_source confirmation_source,
  confirmed_at timestamptz,
  reschedule_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, cycle_no)
);
-- Only one live (non-terminal) cycle per job
create unique index job_cycles_one_live_per_job
  on job_cycles (job_id)
  where status not in ('RECIRCULATED', 'CLOSED', 'CANCELLED');

create table cycle_suppliers (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references job_cycles (id) on delete cascade,
  supplier_id uuid not null references supplier_companies (id),
  invited_at timestamptz,
  response_status response_status not null default 'pending',
  response_at timestamptz,
  attendance_status attendance_status not null default 'not_marked',
  unique (cycle_id, supplier_id)
);

-- BR-12: a supplier who attended an earlier cycle of the same job cannot be re-selected
create function check_recirculation_eligibility() returns trigger
language plpgsql as $$
declare
  v_job_id uuid;
begin
  select job_id into v_job_id from job_cycles where id = new.cycle_id;
  if exists (
    select 1
    from cycle_suppliers cs
    join job_cycles jc on jc.id = cs.cycle_id
    where jc.job_id = v_job_id
      and cs.supplier_id = new.supplier_id
      and cs.attendance_status = 'attended'
  ) then
    raise exception 'Supplier % already attended an earlier cycle of this job (BR-12)', new.supplier_id;
  end if;
  return new;
end $$;

create trigger cycle_suppliers_recirculation_check
  before insert on cycle_suppliers
  for each row execute function check_recirculation_eligibility();

-- ---------------------------------------------------------------- decisions and closures

create table override_decisions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references job_cycles (id) on delete cascade,
  decision override_decision_type not null,
  justification text,
  available_count int not null,
  decided_by uuid not null references profiles (id),
  decided_at timestamptz not null default now(),
  -- BR-08: proceeding with two suppliers requires evidence
  constraint proceed_requires_justification
    check (decision <> 'proceed' or length(trim(coalesce(justification, ''))) > 0)
);

create table engineer_closures (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null unique references job_cycles (id) on delete cascade,
  visit_happened boolean not null,
  closed_by uuid not null references profiles (id),
  closed_at timestamptz not null default now()
);

create table procurement_closures (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs (id) on delete cascade,
  cycle_id uuid not null references job_cycles (id) on delete cascade,
  action procurement_action not null,
  reason text,
  closed_by uuid not null references profiles (id),
  closed_at timestamptz not null default now(),
  -- recirculate / cancel require a reason (Section 8.5)
  constraint reason_required_for_recirculate_cancel
    check (action = 'close' or length(trim(coalesce(reason, ''))) > 0)
);

-- ---------------------------------------------------------------- configuration, notifications, audit

create table system_config (
  key text primary key,
  value jsonb not null,
  description text,
  effective_from timestamptz not null default now(),
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now(),
  reason text
);

create table config_history (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  old_value jsonb,
  new_value jsonb not null,
  changed_by uuid references profiles (id),
  changed_at timestamptz not null default now(),
  reason text
);

create function log_config_change() returns trigger
language plpgsql as $$
begin
  insert into config_history (key, old_value, new_value, changed_by, reason)
  values (new.key, case when tg_op = 'UPDATE' then old.value end, new.value, new.updated_by, new.reason);
  return new;
end $$;

create trigger system_config_history
  after insert or update on system_config
  for each row execute function log_config_change();

create table notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id),
  job_id uuid references jobs (id),
  cycle_id uuid references job_cycles (id),
  channel notification_channel not null default 'sms',
  message_type text not null, -- N-01..N-10, OTP
  recipient_mobile text,
  message text not null,
  status notification_status not null default 'queued',
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notification_log_queued_idx on notification_log (status) where status = 'queued';
create index notification_log_cycle_idx on notification_log (cycle_id);

create table reminder_schedule (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references job_cycles (id) on delete cascade,
  reminder_type text not null, -- response_cutoff | supplier_reminder | engineer_closure | procurement_sla | manager_escalation
  due_at timestamptz not null,
  recurrence_minutes int, -- null = one-shot
  status reminder_status not null default 'scheduled',
  idempotency_key text not null unique,
  last_attempt_at timestamptz,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
create index reminder_schedule_due_idx on reminder_schedule (due_at) where status = 'scheduled';

create table report_exports (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  filters jsonb not null default '{}',
  file_path text,
  status text not null default 'pending',
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on audit_log (entity_type, entity_id);
create index audit_log_actor_idx on audit_log (actor_id, created_at);

insert into supabase_migrations.schema_migrations (version, name) values ('20260717000001', 'schema') on conflict (version) do nothing;

-- ===================== 20260717000002_rls.sql =====================
-- GoSee — row level security (SEC-07 RBAC + SEC-08 object-level authorization)

-- Role of the calling user. security definer so RLS on profiles does not recurse.
create function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create function is_dashboard_user() returns boolean
language sql stable as $$
  select auth_role() in ('procurement', 'procurement_manager', 'system_admin')
$$;

-- Supplier company owned by the calling supplier contact
create function my_supplier_company_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from supplier_companies where contact_user_id = auth.uid()
$$;

alter table profiles enable row level security;
alter table categories enable row level security;
alter table sub_categories enable row level security;
alter table supplier_companies enable row level security;
alter table supplier_categories enable row level security;
alter table jobs enable row level security;
alter table job_cycles enable row level security;
alter table cycle_suppliers enable row level security;
alter table override_decisions enable row level security;
alter table engineer_closures enable row level security;
alter table procurement_closures enable row level security;
alter table system_config enable row level security;
alter table config_history enable row level security;
alter table notification_log enable row level security;
alter table reminder_schedule enable row level security;
alter table report_exports enable row level security;
alter table audit_log enable row level security;

-- ---------------------------------------------------------------- profiles

create policy profiles_own_read on profiles
  for select using (id = auth.uid());

create policy profiles_dashboard_all on profiles
  for all using (is_dashboard_user()) with check (is_dashboard_user());

-- Engineers may see contact names of suppliers invited to their cycles (no broader browsing)
create policy profiles_engineer_supplier_contacts on profiles
  for select using (
    auth_role() = 'engineer'
    and id in (
      select sc.contact_user_id
      from supplier_companies sc
      join cycle_suppliers cs on cs.supplier_id = sc.id
      join job_cycles jc on jc.id = cs.cycle_id
      join jobs j on j.id = jc.job_id
      where j.engineer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------- master data

create policy categories_read on categories
  for select using (auth.uid() is not null);
create policy categories_dashboard_write on categories
  for all using (is_dashboard_user()) with check (is_dashboard_user());

create policy sub_categories_read on sub_categories
  for select using (auth.uid() is not null);
create policy sub_categories_dashboard_write on sub_categories
  for all using (is_dashboard_user()) with check (is_dashboard_user());

create policy supplier_companies_dashboard_all on supplier_companies
  for all using (is_dashboard_user()) with check (is_dashboard_user());

create policy supplier_companies_own_read on supplier_companies
  for select using (contact_user_id = auth.uid());

-- Engineers see companies invited to cycles of their assigned jobs
create policy supplier_companies_engineer_read on supplier_companies
  for select using (
    auth_role() = 'engineer'
    and id in (
      select cs.supplier_id
      from cycle_suppliers cs
      join job_cycles jc on jc.id = cs.cycle_id
      join jobs j on j.id = jc.job_id
      where j.engineer_id = auth.uid()
    )
  );

create policy supplier_categories_read on supplier_categories
  for select using (auth.uid() is not null);
create policy supplier_categories_dashboard_write on supplier_categories
  for all using (is_dashboard_user()) with check (is_dashboard_user());

-- ---------------------------------------------------------------- jobs / cycles / responses
-- Writes to these tables happen only through security-definer RPCs; RLS grants read scopes.

create policy jobs_dashboard_read on jobs
  for select using (is_dashboard_user());

create policy jobs_engineer_read on jobs
  for select using (engineer_id = auth.uid());

create policy jobs_supplier_read on jobs
  for select using (
    id in (
      select jc.job_id from job_cycles jc
      join cycle_suppliers cs on cs.cycle_id = jc.id
      where cs.supplier_id in (select my_supplier_company_ids())
    )
  );

create policy job_cycles_dashboard_read on job_cycles
  for select using (is_dashboard_user());

create policy job_cycles_engineer_read on job_cycles
  for select using (
    job_id in (select id from jobs where engineer_id = auth.uid())
  );

create policy job_cycles_supplier_read on job_cycles
  for select using (
    id in (
      select cycle_id from cycle_suppliers
      where supplier_id in (select my_supplier_company_ids())
    )
  );

create policy cycle_suppliers_dashboard_read on cycle_suppliers
  for select using (is_dashboard_user());

create policy cycle_suppliers_engineer_read on cycle_suppliers
  for select using (
    cycle_id in (
      select jc.id from job_cycles jc
      join jobs j on j.id = jc.job_id
      where j.engineer_id = auth.uid()
    )
  );

-- A supplier sees only its own invitation row, never other suppliers' responses
create policy cycle_suppliers_supplier_read on cycle_suppliers
  for select using (supplier_id in (select my_supplier_company_ids()));

create policy override_decisions_dashboard_read on override_decisions
  for select using (is_dashboard_user());

create policy engineer_closures_read on engineer_closures
  for select using (
    is_dashboard_user()
    or cycle_id in (
      select jc.id from job_cycles jc
      join jobs j on j.id = jc.job_id
      where j.engineer_id = auth.uid()
    )
  );

create policy procurement_closures_dashboard_read on procurement_closures
  for select using (is_dashboard_user());

-- ---------------------------------------------------------------- config / logs / reports

create policy system_config_dashboard_read on system_config
  for select using (is_dashboard_user());
create policy system_config_admin_write on system_config
  for all using (auth_role() = 'system_admin' or auth_role() = 'procurement')
  with check (auth_role() = 'system_admin' or auth_role() = 'procurement');

create policy config_history_dashboard_read on config_history
  for select using (is_dashboard_user());

create policy notification_log_dashboard_read on notification_log
  for select using (is_dashboard_user());

-- App inbox: a user can read notifications addressed to them
create policy notification_log_own_read on notification_log
  for select using (user_id = auth.uid());

create policy reminder_schedule_dashboard_read on reminder_schedule
  for select using (is_dashboard_user());

create policy report_exports_dashboard_all on report_exports
  for all using (is_dashboard_user()) with check (is_dashboard_user());

create policy audit_log_dashboard_read on audit_log
  for select using (is_dashboard_user());

insert into supabase_migrations.schema_migrations (version, name) values ('20260717000002', 'rls') on conflict (version) do nothing;

-- ===================== 20260717000003_rpcs.sql =====================
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

insert into supabase_migrations.schema_migrations (version, name) values ('20260717000003', 'rpcs') on conflict (version) do nothing;

-- ===================== 20260717000004_seed_config.sql =====================
-- GoSee — Section 12 configuration defaults (all values editable in the dashboard)

insert into system_config (key, value, description) values
  ('scheduling_window_hours',        '72',   'Active scheduling window: how far ahead an engineer may select'),
  ('min_lead_time_hours',            '24',   'Minimum lead time before the earliest selectable slot'),
  ('slot_increment_minutes',         '30',   'Timeline granularity / minimum visit duration'),
  ('working_days',                   '[1,2,3,4,5,6]', 'ISO weekday numbers (Mon=1 .. Sun=7) selectable for visits'),
  ('working_hours_start',            '"08:00"', 'Site working hours start'),
  ('working_hours_end',              '"17:00"', 'Site working hours end'),
  ('confirmation_threshold',         '3',    'Available responses that lock the selected time'),
  ('override_count',                 '2',    'Exactly this many Available at cutoff triggers Procurement override'),
  ('response_cutoff_hours',          '24',   'Hours before visit when the final count decision runs'),
  ('min_suppliers_invited',          '3',    'Warn when fewer suppliers are selected'),
  ('supplier_reminder_after_invite_hours', '6', 'First supplier response reminder delay'),
  ('supplier_reminder_before_cutoff_hours', '2', 'Second supplier response reminder before cutoff'),
  ('engineer_closure_grace_minutes', '60',   'After visit time before closure reminders begin'),
  ('engineer_closure_reminder_minutes', '60', 'Repeat frequency of engineer closure reminders'),
  ('procurement_closure_sla_days',   '3',    'Days after engineer close to close / recirculate / cancel'),
  ('manager_escalation_repeat_hours','24',   'Repeat frequency of overdue manager alerts'),
  ('suggestion_gap_minutes',         '45',   'Recommended gap before/after an existing supplier visit'),
  ('otp_validity_minutes',           '5',    'OTP validity period'),
  ('otp_resend_seconds',             '60',   'OTP resend cooldown'),
  ('otp_max_attempts',               '5',    'OTP attempt lockout'),
  ('languages',                      '["en","si","ta"]', 'Available app and SMS template languages')
on conflict (key) do nothing;

insert into supabase_migrations.schema_migrations (version, name) values ('20260717000004', 'seed_config') on conflict (version) do nothing;

-- ===================== 20260717000005_fix_rls_recursion.sql =====================
-- Fix: mutual references between RLS policies (profiles <-> supplier_companies <->
-- cycle_suppliers <-> job_cycles) made Postgres raise "infinite recursion detected
-- in policy". Route every cross-table lookup through a security-definer function,
-- which bypasses RLS internally and breaks the cycle.

create function my_engineer_job_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from jobs where engineer_id = auth.uid()
$$;

create function my_engineer_cycle_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select jc.id
  from job_cycles jc
  join jobs j on j.id = jc.job_id
  where j.engineer_id = auth.uid()
$$;

create function my_supplier_cycle_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select cs.cycle_id
  from cycle_suppliers cs
  join supplier_companies sc on sc.id = cs.supplier_id
  where sc.contact_user_id = auth.uid()
$$;

create function my_supplier_job_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select jc.job_id
  from job_cycles jc
  join cycle_suppliers cs on cs.cycle_id = jc.id
  join supplier_companies sc on sc.id = cs.supplier_id
  where sc.contact_user_id = auth.uid()
$$;

create function engineer_visible_supplier_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select cs.supplier_id
  from cycle_suppliers cs
  join job_cycles jc on jc.id = cs.cycle_id
  join jobs j on j.id = jc.job_id
  where j.engineer_id = auth.uid()
$$;

create function engineer_visible_contact_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select sc.contact_user_id
  from supplier_companies sc
  where sc.id in (select engineer_visible_supplier_ids())
$$;

-- Recreate the policies that used direct cross-table subqueries

drop policy profiles_engineer_supplier_contacts on profiles;
create policy profiles_engineer_supplier_contacts on profiles
  for select using (
    auth_role() = 'engineer' and id in (select engineer_visible_contact_ids())
  );

drop policy supplier_companies_engineer_read on supplier_companies;
create policy supplier_companies_engineer_read on supplier_companies
  for select using (
    auth_role() = 'engineer' and id in (select engineer_visible_supplier_ids())
  );

drop policy jobs_supplier_read on jobs;
create policy jobs_supplier_read on jobs
  for select using (id in (select my_supplier_job_ids()));

drop policy job_cycles_engineer_read on job_cycles;
create policy job_cycles_engineer_read on job_cycles
  for select using (job_id in (select my_engineer_job_ids()));

drop policy job_cycles_supplier_read on job_cycles;
create policy job_cycles_supplier_read on job_cycles
  for select using (id in (select my_supplier_cycle_ids()));

drop policy cycle_suppliers_engineer_read on cycle_suppliers;
create policy cycle_suppliers_engineer_read on cycle_suppliers
  for select using (cycle_id in (select my_engineer_cycle_ids()));

drop policy engineer_closures_read on engineer_closures;
create policy engineer_closures_read on engineer_closures
  for select using (
    is_dashboard_user() or cycle_id in (select my_engineer_cycle_ids())
  );

insert into supabase_migrations.schema_migrations (version, name) values ('20260717000005', 'fix_rls_recursion') on conflict (version) do nothing;

-- ===================== 20260717000006_select_time.sql =====================
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

insert into supabase_migrations.schema_migrations (version, name) values ('20260717000006', 'select_time') on conflict (version) do nothing;

-- ===================== 20260717000007_supplier_respond.sql =====================
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

insert into supabase_migrations.schema_migrations (version, name) values ('20260717000007', 'supplier_respond') on conflict (version) do nothing;

-- ===================== 20260717000008_close_visit.sql =====================
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

insert into supabase_migrations.schema_migrations (version, name) values ('20260717000008', 'close_visit') on conflict (version) do nothing;

-- ===================== 20260717000009_procurement_close.sql =====================
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

insert into supabase_migrations.schema_migrations (version, name) values ('20260717000009', 'procurement_close') on conflict (version) do nothing;

-- ===================== 20260717000010_settings_and_procurement_sms.sql =====================
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

insert into supabase_migrations.schema_migrations (version, name) values ('20260717000010', 'settings_and_procurement_sms') on conflict (version) do nothing;

-- ===================== 20260717000011_recirculation_threshold.sql =====================
-- Recirculation confirms on a lower threshold than the initial cycle: the first
-- visit already happened with attendees, so a recirculated cycle only needs a
-- small number of fresh Available responses (default 1) to lock the time.

insert into system_config (key, value, description) values
  ('recirculation_confirmation_threshold', '1',
   'Available responses that lock the time on a recirculated cycle (cycle R1+)')
on conflict (key) do nothing;

create or replace function rpc_supplier_respond(p_cycle_id uuid, p_available boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cycle job_cycles%rowtype;
  v_job jobs%rowtype;
  v_row cycle_suppliers%rowtype;
  v_new response_status := case when p_available then 'available' else 'not_available' end::response_status;
  v_threshold int;
  v_available_count int;
  v_contact record;
  v_time_label text;
begin
  select * into v_cycle from job_cycles where id = p_cycle_id for update;
  if not found then
    raise exception 'Invitation not found';
  end if;

  -- First cycle uses the full confirmation threshold; recirculated cycles (R1+)
  -- use the lower recirculation threshold so a single acceptance can lock.
  if v_cycle.cycle_no > 0 then
    v_threshold := coalesce((get_config('recirculation_confirmation_threshold'))::int, 1);
  else
    v_threshold := coalesce((get_config('confirmation_threshold'))::int, 3);
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
    null;
  elsif v_cycle.status in ('CONFIRMED', 'VISIT_PENDING') and v_row.response_status = 'pending' then
    null;
  else
    raise exception 'Responses are closed for this visit';
  end if;

  update cycle_suppliers
  set response_status = v_new, response_at = now()
  where id = v_row.id;

  perform write_audit('supplier_response', 'cycle_supplier', v_row.id,
    jsonb_build_object('previous', v_row.response_status),
    jsonb_build_object('response', v_new));

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

      update reminder_schedule
      set status = 'cancelled'
      where cycle_id = p_cycle_id
        and reminder_type in ('response_cutoff', 'supplier_reminder')
        and status = 'scheduled';

      select * into v_job from jobs where id = v_cycle.job_id;
      v_time_label := to_char(v_cycle.selected_time at time zone 'Asia/Colombo', 'DD Mon YYYY HH24:MI');

      -- N-03 to every invited supplier: the first acceptance locks the time, but
      -- all selected suppliers are told the confirmed time (like the initial flow).
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

      perform queue_notification(
        v_job.engineer_id, v_job.id, p_cycle_id, 'N-03',
        format('PR %s visit confirmed for %s. %s supplier(s) available.', v_job.pr_reference, v_time_label, v_available_count)
      );
      perform queue_notification(
        v_job.created_by, v_job.id, p_cycle_id, 'N-03',
        format('PR %s visit confirmed for %s by automatic threshold.', v_job.pr_reference, v_time_label)
      );

      perform write_audit('threshold_confirmed', 'job_cycle', p_cycle_id, null,
        jsonb_build_object('available_count', v_available_count, 'threshold', v_threshold));

      return jsonb_build_object('response', v_new, 'cycle_status', 'CONFIRMED');
    end if;
  end if;

  return jsonb_build_object('response', v_new, 'cycle_status', v_cycle.status);
end $$;

insert into supabase_migrations.schema_migrations (version, name) values ('20260717000011', 'recirculation_threshold') on conflict (version) do nothing;

-- ===================== 20260717000012_timers_worker.sql =====================
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

insert into supabase_migrations.schema_migrations (version, name) values ('20260717000012', 'timers_worker') on conflict (version) do nothing;

