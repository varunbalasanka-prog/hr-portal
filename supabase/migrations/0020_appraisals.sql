-- Staff records, phase 2: appraisals (varun, 27 Oct 2026). A pay rise or promotion after joining happens only after
-- an appraisal interview:
--  1. HR records the interview on the appraisal form (the branches' "Appraisal form 2026"): the 2-minute talk,
--     the last two years' figures, the in-charge's ratings, next year's targets, and both signatures.
--  2. HR proposes the new salary (and designation, for a promotion) with the date it starts.
--  3. An admin approves or turns it down. Approval adds a dated line to the staff register (promotion / increment)
--     and updates the candidate row, so letters show the new salary.
-- Each appraisal keeps a copy of the form it was filled on. Store logins never see appraisals (they hold salaries).
-- After the first month, salary and designation on a working employee's candidate row can only change this way.
-- The form follows the store's business type: Jewellery stores use the jewellery form (the Akshaya Velli one).
-- Automobile stores get theirs once its form is approved; until then their salaries change the old way.
-- Run once in the Supabase SQL editor after 0019. It adds a table and functions only; no collected data is changed.

-- Which appraisal form a business type uses, or null while it has none. A later migration adds 'automobile'.
create or replace function appraisal_kind(p_business_type text) returns text
  language sql immutable set search_path = public as $$
  select case p_business_type when 'Jewellery' then 'jewellery' end
$$;

-- The appraisal form for a working employee's current store, or null.
create or replace function appraisal_form_of(p_employment uuid) returns text
  language sql stable security definer set search_path = public as $$
  select appraisal_kind(b.business_type) from employee_positions p join branches b on b.id = p.branch_id
   where p.employment_id = p_employment and p.to_date is null
$$;
revoke all on function appraisal_form_of(uuid) from public, anon;

create table if not exists appraisals (
  id                   uuid primary key default gen_random_uuid(),
  employment_id        uuid not null references employments (id) on delete cascade,
  cycle                text not null check (cycle ~ '^\d{4}-\d{2}$'),
  status               text not null default 'interviewed' check (status in ('interviewed', 'proposed', 'approved', 'rejected')),
  interview_on         date,
  interviewed_by       text not null,
  form                 jsonb not null,
  answers              jsonb not null default '{}',
  current_designation  text,
  current_basic        numeric(10, 2),
  current_allowances   numeric(10, 2),
  proposed_designation text,
  proposed_basic       numeric(10, 2),
  proposed_allowances  numeric(10, 2),
  effective_from       date,
  proposal_note        text,
  proposed_by          text,
  proposed_at          timestamptz,
  decided_by           text,
  decided_at           timestamptz,
  decision_note        text,
  position_id          bigint references employee_positions (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
-- One appraisal per person per year; one that was turned down can be done again.
create unique index if not exists appraisals_one_per_cycle on appraisals (employment_id, cycle) where status <> 'rejected';
create index if not exists appraisals_status on appraisals (status, created_at desc);

alter table appraisals enable row level security;
drop policy if exists appraisals_admin_read on appraisals;
create policy appraisals_admin_read on appraisals for select to authenticated using (is_admin());

-- The register follows the candidate row, except when an approved appraisal writes both itself.
create or replace function candidates_sync_staff() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.appraisal', true), '') = 'on' then return null; end if;
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

-- After the first month, a working employee's salary and designation change only through an approved appraisal,
-- at stores that have an appraisal form. The first month stays open so a wrong salary or title entered at joining
-- can still be corrected.
create or replace function candidates_guard_appraisal() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(current_setting('app.appraisal', true), '') = 'on' then return new; end if;
  if old.pipeline_status = 'Joined' and new.pipeline_status = 'Joined' and old.actual_joining_date is not null
     and old.actual_joining_date < ist_today() - 30
     and (new.basic_salary is distinct from old.basic_salary or new.allowances is distinct from old.allowances
          or new.designation is distinct from old.designation)
     and (select appraisal_kind(business_type) from branches where id = old.branch_id) is not null then
    raise exception 'Salary and designation changes after the first month go through an appraisal (Staff page).';
  end if;
  return new;
end $$;
revoke all on function candidates_guard_appraisal() from public, anon, authenticated;
drop trigger if exists candidates_guard_appraisal on candidates;
create trigger candidates_guard_appraisal before update on candidates for each row execute function candidates_guard_appraisal();

-- HR or admin, and only for someone they can see. Stores never handle appraisals.
create or replace function can_appraise(p_employment uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select not is_store() and coalesce((select role in ('hr', 'admin', 'superadmin') from profiles where id = auth.uid()), false)
         and can_see_employment(p_employment)
$$;
revoke all on function can_appraise(uuid) from public, anon;

-- Every appraisal the caller may see (HR: the stores they look after; admins: all).
create or replace function appraisal_list() returns setof appraisals
  language sql stable security definer set search_path = public as $$
  select a.* from appraisals a where can_appraise(a.employment_id) order by a.created_at desc
$$;
revoke all on function appraisal_list() from public, anon;
grant execute on function appraisal_list() to authenticated;

-- Step 1: start or update the interview record. p_id null = new appraisal for this person and year.
create or replace function save_appraisal_interview(p_id uuid, p_employment uuid, p_cycle text, p_interview_on date,
                                                    p_form jsonb, p_answers jsonb) returns uuid
  language plpgsql security definer set search_path = public as $$
declare a appraisals; em employments; pos employee_positions;
begin
  if p_id is null then
    if not can_appraise(p_employment) then raise exception 'not allowed'; end if;
    select * into em from employments where id = p_employment;
    if em.left_on is not null then raise exception 'Only a working employee can be appraised'; end if;
    if appraisal_form_of(p_employment) is null then raise exception 'This store has no appraisal form yet'; end if;
    if p_form->>'kind' is distinct from appraisal_form_of(p_employment) then
      raise exception 'This store uses the % appraisal form', appraisal_form_of(p_employment);
    end if;
    if exists (select 1 from appraisals where employment_id = p_employment and cycle = p_cycle and status <> 'rejected') then
      raise exception 'This person already has an appraisal for %', p_cycle;
    end if;
    select * into pos from employee_positions where employment_id = p_employment and to_date is null;
    insert into appraisals (employment_id, cycle, interview_on, interviewed_by, form, answers,
                            current_designation, current_basic, current_allowances)
    values (p_employment, p_cycle, p_interview_on, actor_name(), p_form, coalesce(p_answers, '{}'),
            pos.designation, pos.basic, pos.allowances)
    returning * into a;
    return a.id;
  end if;
  select * into a from appraisals where id = p_id;
  if not found or not can_appraise(a.employment_id) then raise exception 'not allowed'; end if;
  if a.status not in ('interviewed', 'proposed') then raise exception 'This appraisal is already decided'; end if;
  update appraisals set interview_on = p_interview_on, answers = coalesce(p_answers, '{}'), updated_at = now() where id = p_id;
  return p_id;
end $$;
revoke all on function save_appraisal_interview(uuid, uuid, text, date, jsonb, jsonb) from public, anon;
grant execute on function save_appraisal_interview(uuid, uuid, text, date, jsonb, jsonb) to authenticated;

-- Step 2: HR proposes. Needs a finished interview: date, the 2-minute talk and both signatures.
create or replace function propose_appraisal(p_id uuid, p_designation text, p_basic numeric, p_allowances numeric,
                                             p_effective date, p_note text) returns void
  language plpgsql security definer set search_path = public as $$
declare a appraisals; pos employee_positions; who text := actor_name(); emp_name text;
begin
  select * into a from appraisals where id = p_id;
  if not found or not can_appraise(a.employment_id) then raise exception 'not allowed'; end if;
  if a.status not in ('interviewed', 'proposed') then raise exception 'This appraisal is already decided'; end if;
  if a.interview_on is null or coalesce((a.answers->>'interview.presentation_done')::boolean, false) is not true
     or coalesce((a.answers->>'signoff.staff_signed')::boolean, false) is not true
     or coalesce((a.answers->>'signoff.incharge_signed')::boolean, false) is not true then
    raise exception 'Finish the interview first: date, the 2-minute talk and both signatures';
  end if;
  if p_basic is null or p_basic <= 0 or coalesce(p_allowances, 0) < 0 then raise exception 'Enter the new basic salary'; end if;
  if p_effective is null then raise exception 'Enter the date the new salary starts'; end if;
  select * into pos from employee_positions where employment_id = a.employment_id and to_date is null;
  if pos.id is null then raise exception 'This person is no longer working'; end if;
  if p_effective <= pos.from_date then raise exception 'The new salary must start after %', to_char(pos.from_date, 'DD-MM-YYYY'); end if;
  update appraisals set status = 'proposed', proposed_designation = nullif(trim(p_designation), ''),
         proposed_basic = p_basic, proposed_allowances = coalesce(p_allowances, 0), effective_from = p_effective,
         proposal_note = nullif(trim(p_note), ''), proposed_by = who, proposed_at = now(), updated_at = now()
   where id = p_id;
  select e.name into emp_name from employments em join employees e on e.id = em.employee_id where em.id = a.employment_id;
  perform notify_admins(who, 'Appraisal approval needed: ' || emp_name || ' (' || a.cycle || '), proposed ₹' || p_basic
    || ' basic + ₹' || coalesce(p_allowances, 0) || ' allowances from ' || to_char(p_effective, 'DD-MM-YYYY') || '. See the Staff page.');
end $$;
revoke all on function propose_appraisal(uuid, text, numeric, numeric, date, text) from public, anon;
grant execute on function propose_appraisal(uuid, text, numeric, numeric, date, text) to authenticated;

-- Step 3: an admin decides. Approval closes the open register line the day before the start date and opens the new one.
create or replace function decide_appraisal(p_id uuid, p_approve boolean, p_note text) returns void
  language plpgsql security definer set search_path = public as $$
declare a appraisals; pos employee_positions; em employments; e employees; new_id bigint; v_change text; who text := actor_name();
begin
  if not is_admin() then raise exception 'Only an admin can approve an appraisal'; end if;
  select * into a from appraisals where id = p_id for update;
  if not found then raise exception 'not found'; end if;
  if a.status <> 'proposed' then raise exception 'Only a proposed appraisal can be decided'; end if;

  if not p_approve then
    update appraisals set status = 'rejected', decided_by = who, decided_at = now(), decision_note = nullif(trim(p_note), ''), updated_at = now() where id = p_id;
  else
    select * into pos from employee_positions where employment_id = a.employment_id and to_date is null for update;
    if pos.id is null then raise exception 'This person is no longer working'; end if;
    if a.effective_from <= pos.from_date then raise exception 'The new salary must start after %', to_char(pos.from_date, 'DD-MM-YYYY'); end if;
    v_change := case
      when a.proposed_designation is not null and a.proposed_designation is distinct from pos.designation then 'promotion'
      when a.proposed_basic + coalesce(a.proposed_allowances, 0) > coalesce(pos.basic, 0) + coalesce(pos.allowances, 0) then 'increment'
      else 'salary change' end;
    update employee_positions set to_date = a.effective_from - 1 where id = pos.id;
    insert into employee_positions (employment_id, branch_id, designation, basic, allowances, from_date, change_type, reason, entered_by, approved_by)
    values (a.employment_id, pos.branch_id, coalesce(a.proposed_designation, pos.designation), a.proposed_basic, coalesce(a.proposed_allowances, 0),
            a.effective_from, v_change, 'Appraisal ' || a.cycle || ' (interview ' || to_char(a.interview_on, 'DD-MM-YYYY') || ')', a.proposed_by, who)
    returning id into new_id;
    update appraisals set status = 'approved', decided_by = who, decided_at = now(), decision_note = nullif(trim(p_note), ''),
           position_id = new_id, updated_at = now() where id = p_id;

    -- Hired through the portal: the candidate row is the current snapshot that letters read.
    select * into em from employments where id = a.employment_id;
    select * into e from employees where id = em.employee_id;
    if e.candidate_id is not null then
      perform set_config('app.appraisal', 'on', true);
      perform set_config('app.trusted', 'on', true);
      update candidates set basic_salary = a.proposed_basic, allowances = coalesce(a.proposed_allowances, 0),
             designation = coalesce(a.proposed_designation, designation)
       where id = e.candidate_id and actual_joining_date = em.joined_on;
      perform set_config('app.appraisal', 'off', true);
      perform set_config('app.trusted', 'off', true);
    end if;
  end if;

  if a.proposed_by is not null then
    insert into notifications (sender, recipient, message)
    select who, a.proposed_by, 'Appraisal ' || case when p_approve then 'approved' else 'not approved' end || ': '
           || (select e2.name from employments em2 join employees e2 on e2.id = em2.employee_id where em2.id = a.employment_id)
           || ' (' || a.cycle || ').' || coalesce(' ' || nullif(trim(p_note), ''), '');
  end if;
  perform log_change(case when p_approve then 'approve appraisal' else 'reject appraisal' end, p_id::text,
                     jsonb_build_object('basic', a.proposed_basic, 'allowances', a.proposed_allowances, 'from', a.effective_from));
end $$;
revoke all on function decide_appraisal(uuid, boolean, text) from public, anon;
grant execute on function decide_appraisal(uuid, boolean, text) to authenticated;
