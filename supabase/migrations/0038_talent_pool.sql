-- 0038: talent pool workflow.
--  * People leave the pool when they join, and Not Suitable / over-age people can't be in it.
--  * Every HR can see the whole pool (only the basics, through talent_pool_others()), not only their own candidates.
--  * HR (not only admins) can call someone back from the pool for a new opening: they start over in follow-up with
--    the HR of the chosen store, and the old record stays in their history.

-- Pool rules, checked on every change.
create or replace function candidates_talent() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.talent_pool and new.pipeline_status = 'Joined' then
    if not old.talent_pool then raise exception 'This person is working here now, so they can''t go in the talent pool.'; end if;
    new.talent_pool := false;  -- joined: they leave the pool by themselves
  end if;
  if new.talent_pool and is_blacklisted(new) then
    if not old.talent_pool then raise exception 'Not Suitable or over-age candidates can''t go in the talent pool.'; end if;
    new.talent_pool := false;
  end if;
  return new;
end $$;
revoke all on function candidates_talent() from public, anon, authenticated;
drop trigger if exists candidates_talent on candidates;
create trigger candidates_talent before update on candidates for each row execute function candidates_talent();

-- Clean up today's pool: people already working here or blocked for good leave it.
update candidates set talent_pool = false
where talent_pool and (pipeline_status = 'Joined' or is_blacklisted(candidates));

-- The pool from other HRs: only what HR needs to decide whether to call (no address, documents or answers).
create or replace function talent_pool_others()
  returns table (id uuid, name text, mobile text, source candidate_source, posts text[], applied_locations text[],
                 branch_id uuid, assigned_hr text, received_at timestamptz, pipeline_status text, rejection_reason text,
                 interview_status text, talent_tags text[], created_at timestamptz, updated_at timestamptz)
  language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.mobile, c.source, c.posts, c.applied_locations, c.branch_id, c.assigned_hr, c.received_at,
         c.pipeline_status, c.rejection_reason, c.interview_status, c.talent_tags, c.created_at, c.updated_at
  from candidates c, profiles p
  where p.id = auth.uid() and p.role = 'hr' and c.talent_pool and not c.reapply_review and not can_see_candidate(c)
  order by c.updated_at desc
$$;
revoke all on function talent_pool_others() from public, anon;
grant execute on function talent_pool_others() to authenticated;

-- restart_candidate() stays admin-only, except when talent_call_back() below calls it.
create or replace function restart_candidate(p_candidate uuid, p_patch jsonb, p_remark text) returns void
  language plpgsql security definer set search_path = public as $$
declare c candidates;
begin
  if not is_admin() and current_setting('app.talent_callback', true) is distinct from 'on' then raise exception 'admin only'; end if;
  select * into c from candidates where id = p_candidate;
  if not found then raise exception 'candidate not found'; end if;
  insert into candidate_events (candidate_id, actor, stage, from_status, to_status, details, remark)
  values (c.id, (me()).username, 'restart', c.pipeline_status, coalesce(p_patch ->> 'pipeline_status', 'Follow-up Not Started'),
          jsonb_build_object('previous', to_jsonb(c) - 'form_data' - 'access_token'), p_remark);
  perform set_config('app.trusted', 'on', true);
  update candidates set
    pipeline_status = coalesce(p_patch ->> 'pipeline_status', 'Follow-up Not Started'),
    source = coalesce((p_patch ->> 'source')::candidate_source, source),
    entry_by = coalesce(p_patch ->> 'entry_by', entry_by),
    posts = case when p_patch ? 'post' and not (p_patch ->> 'post') = any (posts) then posts || (p_patch ->> 'post') else posts end,
    applied_locations = case when p_patch ? 'branch_name' and not (p_patch ->> 'branch_name') = any (applied_locations)
                             then applied_locations || (p_patch ->> 'branch_name') else applied_locations end,
    branch_id = nullif(p_patch ->> 'branch_id', '')::uuid,
    assigned_hr = coalesce(p_patch ->> 'assigned_hr', assigned_hr),
    interview_needed = (p_patch ->> 'interview_needed')::boolean,
    interview_at = (p_patch ->> 'interview_at')::timestamptz,
    expected_joining_date = (p_patch ->> 'expected_joining_date')::date,
    designation = p_patch ->> 'designation',
    basic_salary = 0, allowances = 0, salary_approved_by = null, salary_approved_at = null,
    proposed_basic = nullif(p_patch ->> 'proposed_basic', '')::numeric,
    proposed_allowances = nullif(p_patch ->> 'proposed_allowances', '')::numeric,
    salary_status = case when coalesce(nullif(p_patch ->> 'proposed_basic', '')::numeric, 0) > 0
                           or coalesce(nullif(p_patch ->> 'proposed_allowances', '')::numeric, 0) > 0 then 'proposed' end,
    aadhaar_check = null,
    next_action = coalesce(p_patch ->> 'next_action', 'Follow-up start immediately'),
    next_action_at = coalesce((p_patch ->> 'next_action_at')::timestamptz, now()),
    calling_status = null, calling_action = null, first_call_at = null, first_retry_status = null, first_retry_at = null,
    second_retry_status = null, second_retry_at = null, third_retry_status = null, third_retry_at = null,
    interview_attendance = null, interview_status = null, not_attended_reason = null, reschedule_at = null,
    reschedule_attendance = null, reminder_status = null, reminder_at = null, joining_status = null, not_joined_reason = null,
    revised_joining_date = null, revised_joining_status = null, actual_joining_date = null, employment_status = null,
    left_type = null, relieving_date = null, rejection_reason = null, offer_response = null, offer_responded_at = null,
    offer_decline_reason = null, confirmation_date = null, employee_code = null, shift_time = null, store_details_at = null,
    payroll_completed_at = null, payroll_completed_by = null, last_sms_key = null, last_sms_at = null,
    reapply_review = false, reapply_at = null
  where id = c.id;
end $$;
revoke all on function restart_candidate(uuid, jsonb, text) from public, anon;
grant execute on function restart_candidate(uuid, jsonb, text) to authenticated;

-- Call someone back from the talent pool for an opening at p_branch. Returns the HR who now has them.
create or replace function talent_call_back(p_candidate uuid, p_branch uuid, p_post text, p_remark text) returns text
  language plpgsql security definer set search_path = public as $$
declare c candidates; b branches; who profiles;
begin
  select * into who from profiles where id = auth.uid();
  if not found or not (who.role = 'hr' or is_admin()) then raise exception 'Only HR and admins can call people back from the talent pool.'; end if;
  select * into c from candidates where id = p_candidate for update;
  if not found or not c.talent_pool then raise exception 'This person is not in the talent pool.'; end if;
  if is_blacklisted(c) then raise exception 'Not Suitable or over-age: they can''t be called back.'; end if;
  if c.reapply_review or needs_reapply_review(c) then
    raise exception 'Underage, absconded or rejected at screening: an admin decides from the Re-Apply folder.';
  end if;
  if c.pipeline_status = 'Joined' then raise exception 'This person is working here now.'; end if;
  if not (c.pipeline_status like 'Left%' or c.pipeline_status = any (array[
       'Wrong Number', 'Not Contactable', 'Scheduled Not Contactable', 'Interview Scheduled - No Response',
       'Not Selected - Not Suitable', 'Interview Not Selected - Dropped by Candidate',
       'Interview Rescheduled Not Attended', 'Selected Candidate Dropped'])) then
    raise exception 'Already in follow-up with %.', c.assigned_hr;
  end if;
  select * into b from branches where id = p_branch;
  if not found then raise exception 'Store not found.'; end if;
  perform set_config('app.talent_callback', 'on', true);
  perform restart_candidate(c.id, jsonb_strip_nulls(jsonb_build_object(
    'pipeline_status', 'Follow-up Not Started', 'assigned_hr', b.hr_username, 'branch_id', b.id::text, 'branch_name', b.name,
    'post', nullif(trim(p_post), ''), 'next_action', 'Follow-up start immediately')),
    'Called back from the talent pool for ' || coalesce(nullif(trim(p_post), '') || ' at ', '') || b.name
      || coalesce(': ' || nullif(trim(p_remark), ''), ''));
  perform set_config('app.talent_callback', 'off', true);
  return b.hr_username;
end $$;
revoke all on function talent_call_back(uuid, uuid, text, text) from public, anon;
grant execute on function talent_call_back(uuid, uuid, text, text) to authenticated;
