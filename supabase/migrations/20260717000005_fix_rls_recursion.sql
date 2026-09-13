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
