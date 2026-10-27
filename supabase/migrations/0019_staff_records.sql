-- Staff records, phase 1 (varun's plan of 26 Oct 2026):
--  * Every employee has a dated register: one row per stint at the company (employments) and one row per period in
--    one store, role and salary (employee_positions). A transfer or a pay change closes the open line and opens a new
--    one, so a store keeps its past staff and nothing is overwritten.
--  * The candidate row stays the "current snapshot". Joining, leaving, transfers and pay/role edits on it are copied
--    into the register automatically by a trigger.
--  * Stores are grouped into divisions (by default the brand before " - " in the store name; admin can change it).
--    A move inside a division is "moved out"; a move to another division counts as a loss for the store it left.
--  * Staff who were working before the portal are loaded with import_staff() from the Excel template.
--  * Stores never see salaries. Everyone reads the register through staff_register().
-- Run once in the Supabase SQL editor. It adds tables and functions only; no collected data is changed.

-- ---------------------------------------------------------------------------
-- Divisions
-- ---------------------------------------------------------------------------
alter table branches add column if not exists division text;
update branches set division = trim(split_part(name, ' - ', 1)) where division is null or trim(division) = '';

create or replace function branches_default_division() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.division is null or trim(new.division) = '' then new.division := trim(split_part(new.name, ' - ', 1)); end if;
  new.division := trim(new.division);
  return new;
end $$;
revoke all on function branches_default_division() from public, anon, authenticated;
drop trigger if exists branches_default_division on branches;
create trigger branches_default_division before insert or update on branches for each row execute function branches_default_division();

-- ---------------------------------------------------------------------------
-- The register
-- ---------------------------------------------------------------------------
create table if not exists employees (
  id           uuid primary key default gen_random_uuid(),
  -- Hired through the portal. Erasing the candidate (privacy request) erases their staff record too.
  candidate_id uuid unique references candidates (id) on delete cascade,
  name         text not null,
  mobile       text,
  source       text not null default 'portal' check (source in ('portal', 'import')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists employees_mobile on employees (right(regexp_replace(coalesce(mobile, ''), '\D', '', 'g'), 10));

create table if not exists employments (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees (id) on delete cascade,
  employee_code text,
  joined_on     date not null,
  left_on       date,
  exit_type     text check (exit_type in ('resigned', 'absconded', 'terminated', 'retired', 'other')),
  exit_reason   text,
  rehire        text check (rehire in ('yes', 'no', 'not sure')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (left_on is null or left_on >= joined_on)
);
-- A person works one stint at a time; a rejoin is a new stint.
create unique index if not exists employments_one_open on employments (employee_id) where left_on is null;
create index if not exists employments_dates on employments (joined_on, left_on);

create table if not exists employee_positions (
  id            bigint generated always as identity primary key,
  employment_id uuid not null references employments (id) on delete cascade,
  branch_id     uuid not null references branches (id),
  designation   text,
  basic         numeric(10, 2),
  allowances    numeric(10, 2),
  from_date     date not null,
  to_date       date,               -- last day in this line; empty = current
  change_type   text not null check (change_type in ('joined', 'transfer', 'promotion', 'increment', 'role change', 'demotion', 'salary change', 'correction')),
  reason        text,
  entered_by    text not null default 'system',
  approved_by   text,
  created_at    timestamptz not null default now(),
  check (to_date is null or to_date >= from_date)
);
create unique index if not exists employee_positions_one_open on employee_positions (employment_id) where to_date is null;
create index if not exists employee_positions_branch on employee_positions (branch_id, from_date);
create index if not exists employee_positions_employment on employee_positions (employment_id, from_date);

-- Nobody reads or writes these tables directly (stores must not see salaries); staff_register() and the functions
-- below do. Admins may read them directly for exports.
alter table employees enable row level security;
alter table employments enable row level security;
alter table employee_positions enable row level security;
drop policy if exists employees_admin_read on employees;
create policy employees_admin_read on employees for select to authenticated using (is_admin());
drop policy if exists employments_admin_read on employments;
create policy employments_admin_read on employments for select to authenticated using (is_admin());
drop policy if exists employee_positions_admin_read on employee_positions;
create policy employee_positions_admin_read on employee_positions for select to authenticated using (is_admin());

create or replace function ist_today() returns date
  language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

create or replace function actor_name() returns text
  language sql stable security definer set search_path = public as $$
  select coalesce((select username from profiles where id = auth.uid()), 'system')
$$;
revoke all on function actor_name() from public, anon;

-- ---------------------------------------------------------------------------
-- Keep the register in step with the candidate row
-- ---------------------------------------------------------------------------
create or replace function sync_staff_from_candidate(c candidates) returns void
  language plpgsql security definer set search_path = public as $$
declare
  emp_id uuid; em employments; pos employee_positions;
  today date := ist_today();
  is_left boolean := c.pipeline_status like 'Left%';
  is_working boolean := c.pipeline_status = 'Joined';
  v_end date; v_type text; v_change text;
begin
  select id into emp_id from employees where candidate_id = c.id;

  -- Not (or no longer) an employee: undo a joining that was reverted, keep finished stints.
  if not (is_working or is_left) or c.actual_joining_date is null or c.branch_id is null then
    if emp_id is not null then
      -- Only a stint with nothing after its joining line (a joining marked by mistake).
      delete from employments where employee_id = emp_id and left_on is null
        and not exists (select 1 from employee_positions p where p.employment_id = employments.id and p.change_type <> 'joined');
    end if;
    return;
  end if;

  if emp_id is null then
    insert into employees (candidate_id, name, mobile) values (c.id, c.name, c.mobile) returning id into emp_id;
  else
    update employees set name = c.name, mobile = c.mobile, updated_at = now()
     where id = emp_id and (name is distinct from c.name or mobile is distinct from c.mobile);
  end if;

  -- This joining's stint: the open one, or a finished one with the same joining date (left, or undoing a leave).
  select * into em from employments where employee_id = emp_id and left_on is null;
  if not found then
    select * into em from employments where employee_id = emp_id and joined_on = c.actual_joining_date order by created_at desc limit 1;
  end if;

  if em.id is null then
    insert into employments (employee_id, employee_code, joined_on)
    values (emp_id, c.employee_code, c.actual_joining_date) returning * into em;
    insert into employee_positions (employment_id, branch_id, designation, basic, allowances, from_date, change_type, entered_by)
    values (em.id, c.branch_id, c.designation, c.basic_salary, c.allowances, c.actual_joining_date, 'joined', actor_name());
  else
    -- Undo a leave (status set back to Joined).
    if is_working and em.left_on is not null then
      update employments set left_on = null, exit_type = null, exit_reason = null, rehire = null, updated_at = now() where id = em.id;
      update employee_positions set to_date = null
       where id = (select id from employee_positions where employment_id = em.id order by from_date desc, id desc limit 1);
      em.left_on := null;
    end if;
    -- Corrected joining date.
    if em.joined_on is distinct from c.actual_joining_date then
      update employments set joined_on = c.actual_joining_date, updated_at = now() where id = em.id;
      update employee_positions set from_date = least(c.actual_joining_date, coalesce(to_date, c.actual_joining_date))
       where id = (select id from employee_positions where employment_id = em.id order by from_date, id limit 1);
    end if;
    if em.employee_code is distinct from c.employee_code and c.employee_code is not null then
      update employments set employee_code = c.employee_code, updated_at = now() where id = em.id;
    end if;
  end if;

  -- Store, role or pay changed while working: close the open line and open a new one from today.
  select * into pos from employee_positions where employment_id = em.id and to_date is null;
  if found and (pos.branch_id is distinct from c.branch_id or pos.designation is distinct from c.designation
                or pos.basic is distinct from c.basic_salary or pos.allowances is distinct from c.allowances) then
    if pos.from_date >= today then
      -- Changed on the day the line started (or a future-dated line): a correction of that line.
      update employee_positions set branch_id = c.branch_id, designation = c.designation, basic = c.basic_salary, allowances = c.allowances
       where id = pos.id;
    else
      v_change := case
        when pos.branch_id is distinct from c.branch_id then 'transfer'
        when pos.designation is distinct from c.designation then 'role change'
        when coalesce(c.basic_salary, 0) + coalesce(c.allowances, 0) > coalesce(pos.basic, 0) + coalesce(pos.allowances, 0) then 'increment'
        else 'salary change' end;
      update employee_positions set to_date = today - 1 where id = pos.id;
      insert into employee_positions (employment_id, branch_id, designation, basic, allowances, from_date, change_type, entered_by)
      values (em.id, c.branch_id, c.designation, c.basic_salary, c.allowances, today, v_change, actor_name());
    end if;
  end if;

  -- Left.
  if is_left and em.left_on is null then
    v_end := greatest(coalesce(c.relieving_date, today), c.actual_joining_date);
    v_type := case when c.pipeline_status ilike '%Without Information%' or coalesce(c.left_type, '') ilike '%Without%' then 'absconded' else 'resigned' end;
    update employee_positions set to_date = greatest(v_end, from_date) where employment_id = em.id and to_date is null;
    update employments set left_on = greatest(v_end, (select max(from_date) from employee_positions where employment_id = em.id)),
                           exit_type = v_type, rehire = case when v_type = 'absconded' then 'no' end, updated_at = now()
     where id = em.id;
  elsif is_left and em.left_on is not null and c.relieving_date is not null and em.left_on is distinct from c.relieving_date
        and c.relieving_date >= em.joined_on then
    -- Corrected relieving date.
    update employments set left_on = greatest(c.relieving_date, (select max(from_date) from employee_positions where employment_id = em.id)), updated_at = now()
     where id = em.id;
    update employee_positions set to_date = greatest(c.relieving_date, from_date)
     where id = (select id from employee_positions where employment_id = em.id order by from_date desc, id desc limit 1);
  end if;
end $$;
revoke all on function sync_staff_from_candidate(candidates) from public, anon, authenticated;

create or replace function candidates_sync_staff() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and new.pipeline_status not like 'Left%' and new.pipeline_status <> 'Joined'
     and old.pipeline_status not like 'Left%' and old.pipeline_status <> 'Joined' then
    return null; -- an applicant moving through the pipeline: nothing to record
  end if;
  if tg_op = 'UPDATE'
     and (new.pipeline_status, new.branch_id, new.actual_joining_date, new.relieving_date, new.designation, new.basic_salary,
          new.allowances, new.employee_code, new.name, new.mobile, new.left_type)
         is not distinct from
         (old.pipeline_status, old.branch_id, old.actual_joining_date, old.relieving_date, old.designation, old.basic_salary,
          old.allowances, old.employee_code, old.name, old.mobile, old.left_type) then
    return null;
  end if;
  perform sync_staff_from_candidate(new);
  return null;
end $$;
revoke all on function candidates_sync_staff() from public, anon, authenticated;
drop trigger if exists candidates_sync_staff on candidates;
create trigger candidates_sync_staff after insert or update on candidates for each row execute function candidates_sync_staff();

-- ---------------------------------------------------------------------------
-- Who can see an employee: admins all; HR the stores they look after; a store its own staff (present or past).
-- ---------------------------------------------------------------------------
create or replace function can_see_employment(p_employment uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select case
    when p.role in ('admin', 'superadmin') then is_admin()
    when p.role = 'hr' then exists (select 1 from employee_positions ep join branches b on b.id = ep.branch_id
                                    where ep.employment_id = p_employment and b.hr_username = p.username)
    when p.role = 'branch' then exists (select 1 from employee_positions ep where ep.employment_id = p_employment and ep.branch_id = p.branch_id)
    else false end
  from profiles p where p.id = auth.uid()
$$;
revoke all on function can_see_employment(uuid) from public, anon;

-- Every stint the caller may see (optionally only those that touched one store), with its full timeline.
-- Salaries are left out for store logins.
create or replace function staff_register(p_branch uuid default null) returns jsonb
  language sql stable security definer set search_path = public as $$
  with me as (select is_store() as store),
  ems as (
    select em.* from employments em
    where can_see_employment(em.id)
      and (p_branch is null or exists (select 1 from employee_positions ep where ep.employment_id = em.id and ep.branch_id = p_branch))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', em.id, 'employee_id', e.id, 'candidate_id', e.candidate_id, 'name', e.name, 'mobile', e.mobile, 'source', e.source,
      'employee_code', em.employee_code, 'joined_on', em.joined_on, 'left_on', em.left_on, 'exit_type', em.exit_type,
      'exit_reason', em.exit_reason, 'rehire', em.rehire,
      'confirmation_date', c.confirmation_date, 'confirmed', c.confirmation_approved_at is not null and em.left_on is null,
      'positions', (select jsonb_agg(jsonb_build_object(
          'id', ep.id, 'branch_id', ep.branch_id, 'designation', ep.designation,
          'basic', case when (select store from me) then null else ep.basic end,
          'allowances', case when (select store from me) then null else ep.allowances end,
          'from_date', ep.from_date, 'to_date', ep.to_date, 'change_type', ep.change_type, 'reason', ep.reason,
          'entered_by', ep.entered_by) order by ep.from_date, ep.id)
        from employee_positions ep where ep.employment_id = em.id)
    ) order by e.name), '[]'::jsonb)
  from ems em join employees e on e.id = em.employee_id
  left join candidates c on c.id = e.candidate_id and c.actual_joining_date = em.joined_on
$$;
revoke all on function staff_register(uuid) from public, anon;
grant execute on function staff_register(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Import from the Excel template (run by Claude or an admin). p_rows is a JSON array of objects with keys:
-- store, name, mobile, employee_code, designation, joined_on (YYYY-MM-DD), basic, allowances, status (Working/Left),
-- left_on, exit_type, exit_reason, rehire, notes. With p_dry_run nothing is saved; the summary says what would happen.
-- A person already in the register (same mobile, same joining date) is skipped, so running the file twice is safe.
-- ---------------------------------------------------------------------------
create or replace function import_staff(p_rows jsonb, p_dry_run boolean default true) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r jsonb; i int := 0; b branches; emp_id uuid; em_id uuid; v_mobile text; v_join date; v_left date; v_type text;
  added int := 0; added_left int := 0; problems jsonb := '[]'; skipped jsonb := '[]';
begin
  if not (auth.uid() is null or is_admin()) then raise exception 'Only an admin can import staff'; end if;
  begin
    for r in select * from jsonb_array_elements(p_rows) loop
      i := i + 1;
      select * into b from branches where lower(trim(name)) = lower(trim(r->>'store'));
      v_mobile := right(regexp_replace(coalesce(r->>'mobile', ''), '\D', '', 'g'), 10);
      v_join := nullif(r->>'joined_on', '')::date;
      v_left := nullif(r->>'left_on', '')::date;
      if b.id is null then problems := problems || jsonb_build_object('row', i, 'name', r->>'name', 'problem', 'unknown store: ' || coalesce(r->>'store', '')); continue; end if;
      if coalesce(trim(r->>'name'), '') = '' or v_join is null then problems := problems || jsonb_build_object('row', i, 'name', r->>'name', 'problem', 'name and date of joining are required'); continue; end if;
      if length(v_mobile) <> 10 then problems := problems || jsonb_build_object('row', i, 'name', r->>'name', 'problem', 'mobile must have 10 digits'); continue; end if;
      if lower(coalesce(r->>'status', 'working')) = 'left' and (v_left is null or v_left < v_join) then
        problems := problems || jsonb_build_object('row', i, 'name', r->>'name', 'problem', 'a person who left needs a last working day on or after joining'); continue;
      end if;

      select e.id into emp_id from employees e where right(regexp_replace(coalesce(e.mobile, ''), '\D', '', 'g'), 10) = v_mobile limit 1;
      if emp_id is not null and exists (select 1 from employments where employee_id = emp_id and (joined_on = v_join or (left_on is null and lower(coalesce(r->>'status', 'working')) <> 'left'))) then
        skipped := skipped || jsonb_build_object('row', i, 'name', r->>'name', 'why', 'already in the register');
        -- Fill a missing employee code from the file.
        update employments set employee_code = nullif(trim(r->>'employee_code'), ''), updated_at = now()
         where employee_id = emp_id and employee_code is null and nullif(trim(r->>'employee_code'), '') is not null
           and (joined_on = v_join or left_on is null);
        continue;
      end if;
      if emp_id is null then
        insert into employees (name, mobile, source) values (trim(r->>'name'), v_mobile, 'import') returning id into emp_id;
      end if;

      v_type := case lower(coalesce(r->>'exit_type', ''))
        when 'resigned' then 'resigned' when 'left without information' then 'absconded' when 'absconded' then 'absconded'
        when 'terminated' then 'terminated' when 'retired' then 'retired' when '' then null else 'other' end;
      insert into employments (employee_id, employee_code, joined_on, left_on, exit_type, exit_reason, rehire, notes)
      values (emp_id, nullif(trim(r->>'employee_code'), ''), v_join,
              case when lower(coalesce(r->>'status', 'working')) = 'left' then v_left end,
              case when lower(coalesce(r->>'status', 'working')) = 'left' then coalesce(v_type, 'other') end,
              nullif(trim(r->>'exit_reason'), ''),
              case lower(coalesce(r->>'rehire', '')) when 'yes' then 'yes' when 'no' then 'no' when 'not sure' then 'not sure' end,
              nullif(trim(r->>'notes'), ''))
      returning id into em_id;
      insert into employee_positions (employment_id, branch_id, designation, basic, allowances, from_date, to_date, change_type, entered_by, reason)
      values (em_id, b.id, nullif(trim(r->>'designation'), ''), nullif(r->>'basic', '')::numeric, nullif(r->>'allowances', '')::numeric, v_join,
              case when lower(coalesce(r->>'status', 'working')) = 'left' then v_left end, 'joined', actor_name(), 'Imported from staff list');
      added := added + 1;
      if lower(coalesce(r->>'status', 'working')) = 'left' then added_left := added_left + 1; end if;
    end loop;
    if p_dry_run then raise exception using errcode = 'P0001', message = 'dry run'; end if;
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'dry run' then raise; end if;
  end;
  if not p_dry_run then perform log_change('import staff', null, jsonb_build_object('added', added, 'problems', jsonb_array_length(problems))); end if;
  return jsonb_build_object('dry_run', p_dry_run, 'rows', i, 'added', added, 'of_which_left', added_left, 'skipped', skipped, 'problems', problems);
end $$;
revoke all on function import_staff(jsonb, boolean) from public, anon;
grant execute on function import_staff(jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: everyone who joined through the portal so far.
-- ---------------------------------------------------------------------------
do $$
declare c candidates;
begin
  for c in select * from candidates where (pipeline_status = 'Joined' or pipeline_status like 'Left%') and actual_joining_date is not null and branch_id is not null loop
    perform sync_staff_from_candidate(c);
  end loop;
end $$;
