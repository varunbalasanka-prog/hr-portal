-- Admin corrections (varun, 19 Nov 2026): admins (admin + superadmin, is_admin()) can correct mistakes in a person's
-- details at every stage. Every correction needs a short reason, and is saved in Change history (old -> new) and in the
-- candidate's own History tab. Uploaded documents are NOT replaced here (they still go back to the candidate).
--   1. admin_correct_candidate: name, mobile, email, address, father/husband, marital status.
--   2. admin_correct_onboarding: the typed details of the onboarding form (family, emergency contact, ESI/UAN ...).
--   3. admin_correct_employee: name and mobile of an imported staff member (portal hires are corrected through 1).
--   4. admin_set_status: put a candidate back to Follow-up, Interview scheduled, Selected (waiting to join) or Joined.
--   5. admin_undo_leaving: an imported staff member relieved by mistake goes back to working.
-- Only adds functions; no table or data changes. Safe to run more than once.

create or replace function correction_reason(p_reason text) returns text
  language plpgsql immutable as $$
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Write a short reason for the correction.'; end if;
  return left(trim(p_reason), 300);
end $$;
revoke all on function correction_reason(text) from public, anon, authenticated;

-- 1. Personal details on the candidate record. Portal hires' staff record follows automatically (sync_staff_from_candidate).
create or replace function admin_correct_candidate(p_id uuid, p_fields jsonb, p_reason text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  c candidates; v_reason text := correction_reason(p_reason);
  k text; v text; diff jsonb := '{}';
  v_name text; v_mobile text; v_email text; v_address text; v_father text; v_marital text;
begin
  if not is_admin() then raise exception 'Only an admin can correct details.'; end if;
  select * into c from candidates where id = p_id for update;
  if not found then raise exception 'Candidate not found.'; end if;
  for k in select jsonb_object_keys(coalesce(p_fields, '{}')) loop
    if k not in ('name', 'mobile', 'email', 'address', 'father_name', 'marital_status') then
      raise exception 'This detail cannot be corrected here: %', k;
    end if;
  end loop;

  v_name    := case when p_fields ? 'name' then left(trim(p_fields ->> 'name'), 120) else c.name end;
  v_mobile  := case when p_fields ? 'mobile' then right(regexp_replace(coalesce(p_fields ->> 'mobile', ''), '\D', '', 'g'), 10) else c.mobile end;
  v_email   := case when p_fields ? 'email' then nullif(left(trim(p_fields ->> 'email'), 120), '') else c.email end;
  v_address := case when p_fields ? 'address' then nullif(left(trim(p_fields ->> 'address'), 500), '') else c.address end;
  v_father  := case when p_fields ? 'father_name' then nullif(left(trim(p_fields ->> 'father_name'), 120), '') else c.father_name end;
  v_marital := case when p_fields ? 'marital_status' then nullif(left(trim(p_fields ->> 'marital_status'), 40), '') else c.marital_status end;
  if coalesce(v_name, '') = '' then raise exception 'Name cannot be empty.'; end if;
  if v_mobile !~ '^[6-9][0-9]{9}$' then raise exception 'Mobile must be 10 digits starting with 6, 7, 8 or 9.'; end if;
  if v_mobile <> c.mobile and exists (select 1 from candidates where mobile = v_mobile and id <> c.id) then
    raise exception 'Another candidate already has the mobile %. Open that record instead.', v_mobile;
  end if;

  if v_name is distinct from c.name then diff := diff || jsonb_build_object('name', jsonb_build_object('from', c.name, 'to', v_name)); end if;
  if v_mobile is distinct from c.mobile then diff := diff || jsonb_build_object('mobile', jsonb_build_object('from', c.mobile, 'to', v_mobile)); end if;
  if v_email is distinct from c.email then diff := diff || jsonb_build_object('email', jsonb_build_object('from', c.email, 'to', v_email)); end if;
  if v_address is distinct from c.address then diff := diff || jsonb_build_object('address', jsonb_build_object('from', c.address, 'to', v_address)); end if;
  if v_father is distinct from c.father_name then diff := diff || jsonb_build_object('father_name', jsonb_build_object('from', c.father_name, 'to', v_father)); end if;
  if v_marital is distinct from c.marital_status then diff := diff || jsonb_build_object('marital_status', jsonb_build_object('from', c.marital_status, 'to', v_marital)); end if;
  if diff = '{}' then return jsonb_build_object('changed', 0); end if;

  update candidates set name = v_name, mobile = v_mobile, email = v_email, address = v_address,
                        father_name = v_father, marital_status = v_marital, updated_at = now()
   where id = c.id;
  insert into candidate_events (candidate_id, actor, stage, details, remark)
  values (c.id, actor_name(), 'correction', diff, 'Details corrected: ' || v_reason);
  perform log_change('candidate correction', c.id::text, jsonb_build_object('name', v_name, 'what', 'personal details', 'reason', v_reason) || diff);
  return jsonb_build_object('changed', (select count(*) from jsonb_object_keys(diff)));
end $$;
revoke all on function admin_correct_candidate(uuid, jsonb, text) from public, anon;
grant execute on function admin_correct_candidate(uuid, jsonb, text) to authenticated;

-- 2. Typed details of the onboarding form. An empty value removes that detail. Files are not touched.
create or replace function admin_correct_onboarding(p_candidate uuid, p_details jsonb, p_reason text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  ob onboarding_submissions; v_reason text := correction_reason(p_reason);
  k text; v text; old_v text; d jsonb; diff jsonb := '{}'; v_name text;
begin
  if not is_admin() then raise exception 'Only an admin can correct details.'; end if;
  select * into ob from onboarding_submissions where candidate_id = p_candidate for update;
  if not found then raise exception 'This candidate has not submitted the onboarding form yet.'; end if;
  d := ob.details;
  for k, v in select key, value from jsonb_each_text(coalesce(p_details, '{}')) loop
    if k = 'consent_version' or k !~ '^[a-z0-9_]{1,40}$' then raise exception 'This detail cannot be corrected here: %', k; end if;
    v := nullif(left(trim(coalesce(v, '')), 200), '');
    old_v := d ->> k;
    if v is not distinct from old_v then continue; end if;
    diff := diff || jsonb_build_object(k, jsonb_build_object('from', old_v, 'to', v));
    d := case when v is null then d - k else d || jsonb_build_object(k, v) end;
  end loop;
  if diff = '{}' then return jsonb_build_object('changed', 0); end if;

  update onboarding_submissions set details = d, updated_at = now() where id = ob.id;
  select name into v_name from candidates where id = p_candidate;
  insert into candidate_events (candidate_id, actor, stage, details, remark)
  values (p_candidate, actor_name(), 'correction', diff, 'Onboarding details corrected: ' || v_reason);
  perform log_change('candidate correction', p_candidate::text, jsonb_build_object('name', v_name, 'what', 'onboarding form details', 'reason', v_reason) || diff);
  return jsonb_build_object('changed', (select count(*) from jsonb_object_keys(diff)));
end $$;
revoke all on function admin_correct_onboarding(uuid, jsonb, text) from public, anon;
grant execute on function admin_correct_onboarding(uuid, jsonb, text) to authenticated;

-- 3. Imported staff (no candidate record): name and mobile on the register.
create or replace function admin_correct_employee(p_employee uuid, p_name text, p_mobile text, p_reason text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  e employees; v_reason text := correction_reason(p_reason);
  v_name text := left(trim(coalesce(p_name, '')), 120);
  v_mobile text := right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10);
  diff jsonb := '{}';
begin
  if not is_admin() then raise exception 'Only an admin can correct details.'; end if;
  select * into e from employees where id = p_employee for update;
  if not found then raise exception 'Staff member not found.'; end if;
  if e.candidate_id is not null then raise exception 'This person was hired through the portal. Correct the details on their candidate card instead.'; end if;
  if v_name = '' then raise exception 'Name cannot be empty.'; end if;
  if v_mobile = '' then v_mobile := null;
  elsif v_mobile !~ '^[6-9][0-9]{9}$' then raise exception 'Mobile must be 10 digits starting with 6, 7, 8 or 9.';
  end if;
  if v_mobile is not null and v_mobile is distinct from right(regexp_replace(coalesce(e.mobile, ''), '\D', '', 'g'), 10)
     and exists (select 1 from employees x where x.id <> e.id and right(regexp_replace(coalesce(x.mobile, ''), '\D', '', 'g'), 10) = v_mobile) then
    raise exception 'Another staff member already has the mobile %.', v_mobile;
  end if;
  if v_name is distinct from e.name then diff := diff || jsonb_build_object('name', jsonb_build_object('from', e.name, 'to', v_name)); end if;
  if v_mobile is distinct from e.mobile then diff := diff || jsonb_build_object('mobile', jsonb_build_object('from', e.mobile, 'to', v_mobile)); end if;
  if diff = '{}' then return jsonb_build_object('changed', 0); end if;
  update employees set name = v_name, mobile = v_mobile, updated_at = now() where id = e.id;
  perform log_change('staff correction', e.id::text, jsonb_build_object('name', v_name, 'what', 'staff details', 'reason', v_reason) || diff);
  return jsonb_build_object('changed', (select count(*) from jsonb_object_keys(diff)));
end $$;
revoke all on function admin_correct_employee(uuid, text, text, text) from public, anon;
grant execute on function admin_correct_employee(uuid, text, text, text) to authenticated;

-- 4. Put a candidate back to an earlier (or the right) stage. Later-stage answers are cleared so the stage forms start
--    clean; everything stays in History and Change history.
--    p_target: 'followup' | 'interview' (p_at = interview time) | 'selected' (p_date = expected joining) | 'joined' (p_date = joining day)
create or replace function admin_set_status(p_candidate uuid, p_target text, p_at timestamptz, p_date date, p_reason text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  c candidates; n candidates; v_reason text := correction_reason(p_reason);
  was_staff boolean; emp uuid;
begin
  if not is_admin() then raise exception 'Only an admin can correct a status.'; end if;
  select * into c from candidates where id = p_candidate for update;
  if not found then raise exception 'Candidate not found.'; end if;
  was_staff := c.pipeline_status = 'Joined' or c.pipeline_status like 'Left%';
  select id into emp from employees where candidate_id = c.id;

  -- Someone with transfers, increments or appraisals on the Staff page can't be un-joined from here.
  if was_staff and p_target <> 'joined' and exists (
      select 1 from employments em join employee_positions p on p.employment_id = em.id
      where em.employee_id = emp and em.joined_on = c.actual_joining_date and p.change_type <> 'joined') then
    raise exception 'This person already has a transfer, increment or role change on the Staff page, so they cannot be moved out of Joined here.';
  end if;

  n := c;
  -- Clear everything after the chosen stage.
  n.joining_status := null; n.not_joined_reason := null; n.revised_joining_date := null; n.revised_joining_status := null;
  n.actual_joining_date := null; n.employment_status := null; n.left_type := null; n.relieving_date := null;
  n.rejection_reason := null;

  if p_target = 'followup' then
    n.pipeline_status := 'Follow-up Not Started';
    n.calling_status := null; n.calling_action := null;
    n.first_retry_status := null; n.second_retry_status := null; n.third_retry_status := null;
    n.interview_at := null; n.interview_attendance := null; n.interview_status := null; n.not_attended_reason := null;
    n.reschedule_at := null; n.reschedule_attendance := null; n.reminder_status := null; n.reminder_at := null;
    n.next_action := 'Follow-up start immediately'; n.next_action_at := now();
  elsif p_target = 'interview' then
    if p_at is null then raise exception 'Choose the interview date and time.'; end if;
    n.pipeline_status := 'Interview Scheduled';
    n.calling_status := 'Contacted'; n.calling_action := 'Interview Scheduled';
    n.interview_at := p_at; n.interview_attendance := null; n.interview_status := null; n.not_attended_reason := null;
    n.reschedule_at := null; n.reschedule_attendance := null; n.reminder_status := null; n.reminder_at := null;
    n.next_action := 'Check interview attendance'; n.next_action_at := p_at;
  elsif p_target = 'selected' then
    if p_date is null then raise exception 'Choose the expected joining date.'; end if;
    if c.branch_id is null then raise exception 'Allocate a branch first (Profile tab), then set Selected.'; end if;
    n.pipeline_status := 'Expected Joining';
    n.interview_attendance := coalesce(c.interview_attendance, 'Attended'); n.interview_status := 'Selected';
    n.expected_joining_date := p_date;
    n.next_action := 'Check joining status (' || p_date || ')'; n.next_action_at := p_date::timestamp at time zone 'Asia/Kolkata';
  elsif p_target = 'joined' then
    if p_date is null then raise exception 'Choose the joining date.'; end if;
    if c.branch_id is null then raise exception 'Allocate a branch first (Profile tab), then set Joined.'; end if;
    if not (c.salary_status = 'approved' or (c.salary_status is null and coalesce(c.basic_salary, 0) > 0)) then
      raise exception 'The salary is not approved yet. Approve it first, then set Joined.';
    end if;
    n.pipeline_status := 'Joined'; n.interview_status := 'Selected';
    n.interview_attendance := coalesce(c.interview_attendance, 'Attended');
    n.joining_status := 'Joined'; n.actual_joining_date := p_date; n.employment_status := 'Working';
    n.next_action := 'Joined successfully'; n.next_action_at := null;
  else
    raise exception 'Unknown status: %', p_target;
  end if;

  update candidates set
    pipeline_status = n.pipeline_status, calling_status = n.calling_status, calling_action = n.calling_action,
    first_retry_status = n.first_retry_status, second_retry_status = n.second_retry_status, third_retry_status = n.third_retry_status,
    interview_at = n.interview_at, interview_attendance = n.interview_attendance, interview_status = n.interview_status,
    not_attended_reason = n.not_attended_reason, reschedule_at = n.reschedule_at, reschedule_attendance = n.reschedule_attendance,
    reminder_status = n.reminder_status, reminder_at = n.reminder_at,
    expected_joining_date = n.expected_joining_date, joining_status = n.joining_status, not_joined_reason = n.not_joined_reason,
    revised_joining_date = n.revised_joining_date, revised_joining_status = n.revised_joining_status,
    actual_joining_date = n.actual_joining_date, employment_status = n.employment_status, left_type = n.left_type,
    relieving_date = n.relieving_date, rejection_reason = n.rejection_reason,
    next_action = n.next_action, next_action_at = n.next_action_at, updated_at = now()
  where id = c.id;

  -- Left by mistake and now working again: the finished exit no longer applies.
  if p_target = 'joined' and c.pipeline_status like 'Left%' then
    update staff_exits set status = 'cancelled', cancelled_by = actor_name(), cancel_note = 'Status corrected: ' || v_reason, updated_at = now()
     where status = 'relieved' and employment_id in (select id from employments where employee_id = emp and left_on is null);
  end if;

  insert into candidate_events (candidate_id, actor, stage, from_status, to_status, remark)
  values (c.id, actor_name(), 'correction', c.pipeline_status, n.pipeline_status, 'Status corrected: ' || v_reason);
  perform log_change('candidate correction', c.id::text, jsonb_build_object('name', c.name, 'what', 'status', 'reason', v_reason,
    'pipeline_status', jsonb_build_object('from', c.pipeline_status, 'to', n.pipeline_status)));
  return jsonb_build_object('status', n.pipeline_status);
end $$;
revoke all on function admin_set_status(uuid, text, timestamptz, date, text) from public, anon;
grant execute on function admin_set_status(uuid, text, timestamptz, date, text) to authenticated;

-- 5. Imported staff relieved by mistake: back to working (the stint reopens; the exit record is cancelled).
create or replace function admin_undo_leaving(p_employment uuid, p_reason text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  em employments; e employees; v_reason text := correction_reason(p_reason);
begin
  if not is_admin() then raise exception 'Only an admin can correct a status.'; end if;
  select * into em from employments where id = p_employment for update;
  if not found then raise exception 'Staff record not found.'; end if;
  select * into e from employees where id = em.employee_id;
  if e.candidate_id is not null then raise exception 'This person was hired through the portal. Use "Correct status" on their candidate card.'; end if;
  if em.left_on is null then raise exception 'This person is already working.'; end if;
  if exists (select 1 from employments where employee_id = em.employee_id and left_on is null) then
    raise exception 'This person already has a current job on the register.';
  end if;
  update employments set left_on = null, exit_type = null, exit_reason = null, rehire = null, updated_at = now() where id = em.id;
  update employee_positions set to_date = null
   where id = (select id from employee_positions where employment_id = em.id order by from_date desc, id desc limit 1);
  update staff_exits set status = 'cancelled', cancelled_by = actor_name(), cancel_note = 'Leaving undone: ' || v_reason, updated_at = now()
   where employment_id = em.id and status = 'relieved';
  perform log_change('staff correction', em.id::text, jsonb_build_object('name', e.name, 'what', 'staff status', 'reason', v_reason,
    'left_on', jsonb_build_object('from', em.left_on, 'to', null), 'exit_type', jsonb_build_object('from', em.exit_type, 'to', null)));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function admin_undo_leaving(uuid, text) from public, anon;
grant execute on function admin_undo_leaving(uuid, text) to authenticated;
