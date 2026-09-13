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
