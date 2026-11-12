-- Staff records, phase 3: the exit process (varun's plan of 26 Oct 2026, chosen 11 Nov 2026). Works for every
-- employee in the staff register, including the staff imported from the Excel list.
--   1. The store raises the resignation (or absconding) with the last working day. HR can also start one directly.
--   2. HR confirms the last working day.
--   3. HR takes the exit interview by phone or in person (bilingual questions, admin-editable), or skips it with a reason.
--   4. On or after the last working day HR relieves the employee. The register line closes and, for someone hired
--      through the portal, the candidate row is marked Left as well, so letters, lists and re-apply rules follow.
--   The relieving letter opens only after step 4. No clearance checklist (varun's answer 7).
-- Store logins see the status, how they left and the dates; never the interview answers, HR notes or rehire (answer 3).
-- Each interview keeps a copy of the questions it was taken on, so editing the questions never changes past interviews.
-- Run once in the Supabase SQL editor after 0019 and 0020. It adds tables and functions only; no collected data is changed.

-- ---------------------------------------------------------------------------
-- Exit interview questions (one row; the starting questions live in lib/exit.ts)
-- ---------------------------------------------------------------------------
create table if not exists exit_form (
  id         int primary key default 1 check (id = 1),
  form       jsonb not null,
  updated_by text not null,
  updated_at timestamptz not null default now()
);
alter table exit_form enable row level security;
drop policy if exists exit_form_read on exit_form;
create policy exit_form_read on exit_form for select to authenticated using (not is_store());
drop policy if exists exit_form_admin_write on exit_form;
create policy exit_form_admin_write on exit_form for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Exits: one per leaving
-- ---------------------------------------------------------------------------
create table if not exists staff_exits (
  id               uuid primary key default gen_random_uuid(),
  employment_id    uuid not null references employments (id) on delete cascade,
  status           text not null default 'raised' check (status in ('raised', 'confirmed', 'relieved', 'cancelled')),
  kind             text not null check (kind in ('resigned', 'absconded', 'terminated', 'retired', 'other')),
  reason_given     text,
  informed_on      date,              -- day the employee resigned, or was last seen (absconding)
  last_day         date not null,     -- last working day
  raised_by        text not null,
  raised_at        timestamptz not null default now(),
  confirmed_by     text,
  confirmed_at     timestamptz,
  interview_status text not null default 'pending' check (interview_status in ('pending', 'done', 'skipped')),
  interview_mode   text check (interview_mode in ('phone', 'in person')),
  interview_on     date,
  interviewed_by   text,
  form             jsonb,
  answers          jsonb not null default '{}',
  skip_reason      text,
  hr_notes         text,
  rehire           text check (rehire in ('yes', 'no', 'not sure')),
  relieved_by      text,
  relieved_at      timestamptz,
  cancelled_by     text,
  cancel_note      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- One open exit per stint.
create unique index if not exists staff_exits_one_open on staff_exits (employment_id) where status in ('raised', 'confirmed');
create index if not exists staff_exits_status on staff_exits (status, last_day);

alter table staff_exits enable row level security;
drop policy if exists staff_exits_admin_read on staff_exits;
create policy staff_exits_admin_read on staff_exits for select to authenticated using (is_admin());

-- The store an open register line is at, or null if the person is not working.
create or replace function current_branch_of(p_employment uuid) returns uuid
  language sql stable security definer set search_path = public as $$
  select ep.branch_id from employee_positions ep join employments em on em.id = ep.employment_id
   where ep.employment_id = p_employment and ep.to_date is null and em.left_on is null
$$;
revoke all on function current_branch_of(uuid) from public, anon, authenticated;

-- HR (for the stores they look after) and admins handle exits. Same rule as appraisals.
create or replace function can_handle_exit(p_employment uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select not is_store() and coalesce((select role in ('hr', 'admin', 'superadmin') from profiles where id = auth.uid()), false)
         and can_see_employment(p_employment)
$$;
revoke all on function can_handle_exit(uuid) from public, anon;

-- Tell the HR of the person's store and the admins. The link opens the person on the Staff page.
create or replace function notify_exit(p_employment uuid, p_message text, p_skip text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare v_hr text; v_link text := '/staff?open=' || p_employment;
begin
  select b.hr_username into v_hr from employee_positions ep join branches b on b.id = ep.branch_id
   where ep.employment_id = p_employment order by ep.from_date desc, ep.id desc limit 1;
  insert into notifications (sender, recipient, message, link)
  select actor_name(), u, p_message, v_link
    from (select v_hr as u union select username from profiles where role in ('admin', 'superadmin')) r
   where u is not null and u is distinct from p_skip;
end $$;
revoke all on function notify_exit(uuid, text, text) from public, anon, authenticated;

create or replace function exit_person(p_employment uuid) returns text
  language sql stable security definer set search_path = public as $$
  select e.name || coalesce(' (' || em.employee_code || ')', '') || coalesce(', ' || b.name, '')
    from employments em join employees e on e.id = em.employee_id
    left join lateral (select branch_id from employee_positions where employment_id = em.id order by from_date desc, id desc limit 1) ep on true
    left join branches b on b.id = ep.branch_id
   where em.id = p_employment
$$;
revoke all on function exit_person(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Step 1: raise. A store may raise for its own working staff (resigned or absconded) and HR confirms;
-- HR or an admin may start any kind, already confirmed.
-- ---------------------------------------------------------------------------
create or replace function raise_exit(p_employment uuid, p_kind text, p_reason text, p_informed_on date, p_last_day date) returns uuid
  language plpgsql security definer set search_path = public as $$
declare em employments; v_store boolean := is_store(); v_id uuid; who text := actor_name(); v_branch uuid := current_branch_of(p_employment);
begin
  select * into em from employments where id = p_employment;
  if not found or v_branch is null then raise exception 'Only a working employee can be relieved'; end if;
  if v_store then
    if v_branch is distinct from (select branch_id from profiles where id = auth.uid()) then raise exception 'not allowed'; end if;
    if p_kind not in ('resigned', 'absconded') then raise exception 'A store can raise a resignation or absconding only'; end if;
  elsif not can_handle_exit(p_employment) then
    raise exception 'not allowed';
  end if;
  if p_kind not in ('resigned', 'absconded', 'terminated', 'retired', 'other') then raise exception 'Choose how they are leaving'; end if;
  if p_last_day is null then raise exception 'Enter the last working day'; end if;
  if p_last_day < (select max(from_date) from employee_positions where employment_id = p_employment) then
    raise exception 'The last working day can''t be before %', to_char((select max(from_date) from employee_positions where employment_id = p_employment), 'DD-MM-YYYY');
  end if;
  if p_informed_on is not null and p_informed_on > ist_today() then raise exception 'The date they told you can''t be in the future'; end if;
  if exists (select 1 from staff_exits where employment_id = p_employment and status in ('raised', 'confirmed')) then
    raise exception 'An exit is already open for this person';
  end if;
  insert into staff_exits (employment_id, status, kind, reason_given, informed_on, last_day, raised_by, confirmed_by, confirmed_at)
  values (p_employment, case when v_store then 'raised' else 'confirmed' end, p_kind, nullif(trim(p_reason), ''),
          p_informed_on, p_last_day, who, case when v_store then null else who end, case when v_store then null else now() end)
  returning id into v_id;
  perform notify_exit(p_employment,
    case p_kind when 'absconded' then 'Staff absconding: ' else 'Staff resignation: ' end || exit_person(p_employment)
    || ', last working day ' || to_char(p_last_day, 'DD-MM-YYYY') || '. '
    || case when v_store then 'Raised by the store; HR to confirm and take the exit interview.' else 'Exit interview due before the last day.' end, who);
  perform log_change('raise exit', p_employment::text, jsonb_build_object('kind', p_kind, 'last_day', p_last_day));
  return v_id;
end $$;
revoke all on function raise_exit(uuid, text, text, date, date) from public, anon;
grant execute on function raise_exit(uuid, text, text, date, date) to authenticated;

-- Step 2: HR confirms (or corrects) the last working day and how they are leaving. Also used to edit a confirmed exit.
create or replace function confirm_exit(p_id uuid, p_kind text, p_reason text, p_informed_on date, p_last_day date) returns void
  language plpgsql security definer set search_path = public as $$
declare x staff_exits;
begin
  select * into x from staff_exits where id = p_id for update;
  if not found or not can_handle_exit(x.employment_id) then raise exception 'not allowed'; end if;
  if x.status not in ('raised', 'confirmed') then raise exception 'This exit is already closed'; end if;
  if p_kind not in ('resigned', 'absconded', 'terminated', 'retired', 'other') then raise exception 'Choose how they are leaving'; end if;
  if p_last_day is null then raise exception 'Enter the last working day'; end if;
  if p_last_day < (select max(from_date) from employee_positions where employment_id = x.employment_id) then
    raise exception 'The last working day can''t be before %', to_char((select max(from_date) from employee_positions where employment_id = x.employment_id), 'DD-MM-YYYY');
  end if;
  update staff_exits set status = 'confirmed', kind = p_kind, reason_given = nullif(trim(p_reason), ''), informed_on = p_informed_on,
         last_day = p_last_day, confirmed_by = coalesce(confirmed_by, actor_name()), confirmed_at = coalesce(confirmed_at, now()), updated_at = now()
   where id = p_id;
  perform log_change('confirm exit', x.employment_id::text, jsonb_build_object('kind', p_kind, 'last_day', p_last_day));
end $$;
revoke all on function confirm_exit(uuid, text, text, date, date) from public, anon;
grant execute on function confirm_exit(uuid, text, text, date, date) to authenticated;

-- Step 3: HR saves the interview (can be saved again until relieved), or skips it with a reason.
create or replace function save_exit_interview(p_id uuid, p_mode text, p_on date, p_form jsonb, p_answers jsonb, p_notes text, p_rehire text) returns void
  language plpgsql security definer set search_path = public as $$
declare x staff_exits;
begin
  select * into x from staff_exits where id = p_id for update;
  if not found or not can_handle_exit(x.employment_id) then raise exception 'not allowed'; end if;
  if x.status not in ('raised', 'confirmed') then raise exception 'This exit is already closed'; end if;
  if p_mode not in ('phone', 'in person') then raise exception 'Choose phone or in person'; end if;
  if p_on is null or p_on > ist_today() then raise exception 'Enter the day the interview was taken'; end if;
  if p_rehire is not null and p_rehire not in ('yes', 'no', 'not sure') then raise exception 'Unknown rehire answer'; end if;
  update staff_exits set interview_status = 'done', interview_mode = p_mode, interview_on = p_on, interviewed_by = actor_name(),
         -- The questions are copied once, on the first save, so later edits to the questions never change this interview.
         form = coalesce(form, p_form), answers = coalesce(p_answers, '{}'), hr_notes = nullif(trim(p_notes), ''),
         rehire = p_rehire, skip_reason = null, updated_at = now()
   where id = p_id;
  perform log_change('save exit interview', x.employment_id::text, jsonb_build_object('mode', p_mode, 'on', p_on));
end $$;
revoke all on function save_exit_interview(uuid, text, date, jsonb, jsonb, text, text) from public, anon;
grant execute on function save_exit_interview(uuid, text, date, jsonb, jsonb, text, text) to authenticated;

create or replace function skip_exit_interview(p_id uuid, p_reason text, p_rehire text) returns void
  language plpgsql security definer set search_path = public as $$
declare x staff_exits;
begin
  select * into x from staff_exits where id = p_id for update;
  if not found or not can_handle_exit(x.employment_id) then raise exception 'not allowed'; end if;
  if x.status not in ('raised', 'confirmed') then raise exception 'This exit is already closed'; end if;
  if x.interview_status = 'done' then raise exception 'The interview is already saved'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Say why the interview was skipped'; end if;
  if p_rehire is not null and p_rehire not in ('yes', 'no', 'not sure') then raise exception 'Unknown rehire answer'; end if;
  update staff_exits set interview_status = 'skipped', skip_reason = trim(p_reason), rehire = p_rehire, updated_at = now() where id = p_id;
  perform log_change('skip exit interview', x.employment_id::text, jsonb_build_object('reason', trim(p_reason)));
end $$;
revoke all on function skip_exit_interview(uuid, text, text) from public, anon;
grant execute on function skip_exit_interview(uuid, text, text) to authenticated;

-- Step 4: relieve, on or after the last working day, once the interview is done or skipped.
create or replace function relieve_exit(p_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare x staff_exits; em employments; e employees; c candidates; v_end date; v_left_type text; who text := actor_name();
begin
  select * into x from staff_exits where id = p_id for update;
  if not found or not can_handle_exit(x.employment_id) then raise exception 'not allowed'; end if;
  if x.status <> 'confirmed' then raise exception 'Confirm the last working day first'; end if;
  if x.interview_status = 'pending' then raise exception 'Take the exit interview first, or skip it with a reason'; end if;
  if x.last_day > ist_today() then raise exception 'You can relieve them from %', to_char(x.last_day, 'DD-MM-YYYY'); end if;
  select * into em from employments where id = x.employment_id for update;
  if em.left_on is not null then raise exception 'This person is already marked as left'; end if;
  select * into e from employees where id = em.employee_id;
  v_end := greatest(x.last_day, (select max(from_date) from employee_positions where employment_id = em.id));
  v_left_type := case when x.kind = 'absconded' then 'Without Information' else 'With Information' end;

  -- Hired through the portal: mark the candidate row Left too. Its trigger closes the register line.
  if e.candidate_id is not null then
    select * into c from candidates where id = e.candidate_id and actual_joining_date = em.joined_on and pipeline_status = 'Joined';
  end if;
  if c.id is not null then
    perform set_config('app.trusted', 'on', true);
    update candidates set employment_status = 'Left', left_type = v_left_type, relieving_date = v_end,
           pipeline_status = 'Left (' || v_left_type || ')', rejection_reason = 'Joined & Left (' || v_left_type || ')',
           next_action = case when x.kind = 'absconded' then 'Employment terminated (blacklisted)' else 'Employment terminated (re-apply allowed)' end,
           next_action_at = null, updated_at = now()
     where id = c.id;
    perform set_config('app.trusted', 'off', true);
    insert into candidate_events (candidate_id, actor, stage, from_status, to_status, remark)
    values (c.id, who, 'employment', 'Joined', 'Left (' || v_left_type || ')', 'Relieved through the exit process on the Staff page');
  end if;

  -- Close the register line (already closed by the trigger for a portal hire; this also covers imported staff).
  update employee_positions set to_date = greatest(v_end, from_date) where employment_id = em.id and to_date is null;
  update employments set left_on = v_end, exit_type = x.kind,
         exit_reason = coalesce(x.reason_given, exit_reason),
         rehire = case when x.kind = 'absconded' then 'no' else coalesce(x.rehire, rehire) end, updated_at = now()
   where id = em.id;
  update staff_exits set status = 'relieved', relieved_by = who, relieved_at = now(), updated_at = now() where id = p_id;
  perform log_change('relieve exit', x.employment_id::text, jsonb_build_object('kind', x.kind, 'last_day', v_end));
end $$;
revoke all on function relieve_exit(uuid) from public, anon;
grant execute on function relieve_exit(uuid) to authenticated;

-- The employee stays (resignation withdrawn) or it was raised by mistake. The store may cancel its own unconfirmed one.
create or replace function cancel_exit(p_id uuid, p_note text) returns void
  language plpgsql security definer set search_path = public as $$
declare x staff_exits; who text := actor_name();
begin
  select * into x from staff_exits where id = p_id for update;
  if not found then raise exception 'not found'; end if;
  if not (can_handle_exit(x.employment_id)
          or (is_store() and x.status = 'raised' and x.raised_by = who
              and current_branch_of(x.employment_id) = (select branch_id from profiles where id = auth.uid()))) then
    raise exception 'not allowed';
  end if;
  if x.status not in ('raised', 'confirmed') then raise exception 'This exit is already closed'; end if;
  update staff_exits set status = 'cancelled', cancelled_by = who, cancel_note = nullif(trim(p_note), ''), updated_at = now() where id = p_id;
  perform notify_exit(x.employment_id, 'Staff exit cancelled: ' || exit_person(x.employment_id) || ' is staying.'
    || coalesce(' ' || nullif(trim(p_note), ''), ''), who);
  perform log_change('cancel exit', x.employment_id::text, jsonb_build_object('note', nullif(trim(p_note), '')));
end $$;
revoke all on function cancel_exit(uuid, text) from public, anon;
grant execute on function cancel_exit(uuid, text) to authenticated;

-- Every exit the caller may see. Store logins get no interview answers, HR notes, skip reason or rehire.
create or replace function exit_list() returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    case when is_store()
      then to_jsonb(x) - array['form', 'answers', 'hr_notes', 'skip_reason', 'rehire', 'interview_mode', 'interviewed_by']
      else to_jsonb(x) end
    order by x.raised_at desc), '[]'::jsonb)
  from staff_exits x where can_see_employment(x.employment_id)
$$;
revoke all on function exit_list() from public, anon;
grant execute on function exit_list() to authenticated;

-- What the relieving letter needs, for HR and admins. Only for someone relieved through the exit process, or who left
-- before it existed, and who resigned or retired.
create or replace function relieving_letter(p_employment uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', e.name, 'father_name', c.father_name, 'employee_code', em.employee_code,
           'joined_on', em.joined_on, 'left_on', em.left_on, 'kind', em.exit_type,
           'designation', ep.designation, 'store', b.name, 'address', b.address, 'business_type', b.business_type)
    from employments em join employees e on e.id = em.employee_id
    left join candidates c on c.id = e.candidate_id
    left join lateral (select * from employee_positions where employment_id = em.id order by from_date desc, id desc limit 1) ep on true
    left join branches b on b.id = ep.branch_id
   where em.id = p_employment and can_handle_exit(em.id) and em.left_on is not null and em.exit_type in ('resigned', 'retired')
     and not exists (select 1 from staff_exits x where x.employment_id = em.id and x.status in ('raised', 'confirmed'))
$$;
revoke all on function relieving_letter(uuid) from public, anon;
grant execute on function relieving_letter(uuid) to authenticated;

-- Notifications about exits open the Staff page.
create or replace function notification_link_for(p_message text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_mobile text;
  v_id uuid;
begin
  if p_message is null then return null; end if;
  if p_message ~* '(manpower request|temporary staff|^approved: hire)' then return '/manpower'; end if;
  if p_message ~* '^(appraisal |new employee joined|staff list imported|staff resignation|staff absconding|staff exit)' then return '/staff'; end if;
  v_mobile := substring(p_message from '\((\d{10})\)');
  if v_mobile is not null then
    select id into v_id from candidates where mobile = v_mobile limit 1;
    if v_id is not null then return '/dashboard?open=' || v_id; end if;
  end if;
  if p_message ~* '^re-apply folder' then return '/dashboard?list=reapply'; end if;
  if p_message ~* '^confirmation due' then return '/dashboard?list=confirmations'; end if;
  if p_message ~* '^salary approval needed' then return '/dashboard?list=approvals'; end if;
  return null;
end $$;
revoke all on function notification_link_for(text) from public, anon, authenticated;
