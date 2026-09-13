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
