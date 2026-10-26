-- HR workflow rules (varun's spec of 24 Oct 2026), part A. Adds columns, tables and rules only: no collected data
-- is changed, apart from copying the employee code / shift into the candidate row and marking joinings that were
-- already finished as payroll-completed.
--  * Today's SMS list: the last message HR sent from the list, so a row drops off once it is sent.
--  * Routing: a candidate always belongs to the HR of their allocated branch (interview store, or branch after selection).
--  * Stores see walk-ins at once, online applicants only after an interview is scheduled at that store,
--    and never the onboarding documents.
--  * Blacklist: only Not Suitable, over-age (and old "Age Criteria") and other screening rejections stay blocked.
--    Underage rejections and people who left without information go to an admin-only Re-Apply folder when they apply again.
--  * Walk-ins of blocked people need an admin's approval.
--  * Joining: the store enters employee code + shift, then HR completes payroll.
--  * Missing Work: every night the overdue Today's Work tasks are recorded per HR.

-- ---------------------------------------------------------------------------
-- New columns
-- ---------------------------------------------------------------------------
alter table candidates add column if not exists last_sms_key text;
alter table candidates add column if not exists last_sms_at timestamptz;
alter table candidates add column if not exists employee_code text;
alter table candidates add column if not exists shift_time text;
alter table candidates add column if not exists store_details_at timestamptz;
alter table candidates add column if not exists payroll_completed_at timestamptz;
alter table candidates add column if not exists payroll_completed_by text;
alter table candidates add column if not exists reapply_review boolean not null default false;
alter table candidates add column if not exists reapply_at timestamptz;
create index if not exists candidates_reapply on candidates (reapply_review) where reapply_review;

-- Employee code and shift move to the candidate row (the store fills them even before any onboarding form exists).
update candidates c set employee_code = coalesce(c.employee_code, o.employee_code), shift_time = coalesce(c.shift_time, o.shift_time)
from onboarding_submissions o
where o.candidate_id = c.id and (o.employee_code is not null or o.shift_time is not null)
  and (c.employee_code is null or c.shift_time is null);

-- People who joined before this change are treated as finished, so the Completed list stays as it was.
update candidates set payroll_completed_at = coalesce(actual_joining_date::timestamptz, updated_at), payroll_completed_by = 'before payroll step',
                      store_details_at = coalesce(store_details_at, actual_joining_date::timestamptz, updated_at)
where pipeline_status = 'Joined' and payroll_completed_at is null;

-- ---------------------------------------------------------------------------
-- Blacklist (blocked for good) and Re-Apply (admin decides)
-- ---------------------------------------------------------------------------
create or replace function is_blacklisted(c candidates) returns boolean
  language sql immutable as $$
  select coalesce(c.rejection_reason, '') not ilike '%Underage%' and (
         coalesce(c.rejection_reason, '') ilike any (array['%Not Suitable%', '%Age Criteria%', '%Over Age%'])
      or c.pipeline_status like 'Screening Rejected%')
$$;

-- Rejected as underage, or left without information: may apply again, but an admin looks first.
create or replace function needs_reapply_review(c candidates) returns boolean
  language sql immutable as $$
  select coalesce(c.rejection_reason, '') ilike '%Underage%'
      or (c.pipeline_status like 'Left%' and c.pipeline_status like '%Without Information%')
$$;

-- ---------------------------------------------------------------------------
-- Who sees a candidate
-- ---------------------------------------------------------------------------
create or replace function can_see_candidate(c candidates) returns boolean
  language sql stable security definer set search_path = public as $$
  select case
    when p.role in ('admin', 'superadmin') then is_admin()
    when p.role = 'hr' then c.assigned_hr = p.username and not c.reapply_review
    when p.role = 'branch' then not c.reapply_review and (
          (c.source = 'walkin' and (c.branch_id = p.branch_id
             or exists (select 1 from branches b where b.id = p.branch_id and b.name = any (c.applied_locations))))
       or (c.source = 'online' and c.interview_at is not null and (c.branch_id = p.branch_id
             or (c.branch_id is null and exists (select 1 from branches b where b.id = p.branch_id and b.name = c.applied_locations[1])))))
    else false end
  from profiles p where p.id = auth.uid()
$$;

-- Onboarding documents are for HR and admins only.
create or replace function is_store() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'branch' from profiles where id = auth.uid()), false)
$$;
revoke execute on function is_store() from public, anon;
grant execute on function is_store() to authenticated;

alter policy onboarding_read on onboarding_submissions
  using (not is_store() and exists (select 1 from candidates c where c.id = candidate_id and can_see_candidate(c)));
alter policy onboarding_update on onboarding_submissions
  using (not is_store() and exists (select 1 from candidates c where c.id = candidate_id and can_see_candidate(c)));
drop policy if exists onboarding_staff_read on storage.objects;
create policy onboarding_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'onboarding-docs' and not is_store() and exists (
    select 1 from onboarding_submissions o join candidates c on c.id = o.candidate_id
    where can_see_candidate(c) and (name in (select value from jsonb_each_text(o.files))
                                    or c.access_token::text = (storage.foldername(name))[1])));

-- ---------------------------------------------------------------------------
-- Routing: changing the allocated branch hands the candidate to that branch's HR.
-- Named so it runs after the guard triggers (before-triggers run in name order).
-- ---------------------------------------------------------------------------
create or replace function candidates_route() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.branch_id is not null and new.branch_id is distinct from old.branch_id then
    new.assigned_hr := coalesce((select hr_username from branches where id = new.branch_id), new.assigned_hr);
  end if;
  return new;
end $$;
revoke all on function candidates_route() from public, anon, authenticated;
drop trigger if exists candidates_zroute on candidates;
create trigger candidates_zroute before update on candidates for each row execute function candidates_route();

-- Moving a candidate to another branch makes them invisible to the HR who moved them, which an ordinary update
-- can't do (the row must stay visible to the person updating it), so staff move candidates through this function.
create or replace function transfer_candidate(p_candidate uuid, p_branch uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare c candidates; b branches;
begin
  select * into c from candidates where id = p_candidate;
  if not found or not can_see_candidate(c) then raise exception 'candidate not found'; end if;
  select * into b from branches where id = p_branch;
  if not found then raise exception 'branch not found'; end if;
  perform set_config('app.trusted', 'on', true);
  update candidates set branch_id = b.id where id = c.id;  -- candidates_zroute hands them to b.hr_username
  return b.hr_username;
end $$;
revoke all on function transfer_candidate(uuid, uuid) from public, anon;
grant execute on function transfer_candidate(uuid, uuid) to authenticated;

-- Staff may not flip the Re-Apply flag or payroll completion themselves; stores may not complete payroll.
create or replace function candidates_guard_workflow() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or current_setting('app.trusted', true) = 'on' or is_admin() then return new; end if;
  if new.reapply_review is distinct from old.reapply_review or new.reapply_at is distinct from old.reapply_at then
    raise exception 'Only an admin can move a candidate in or out of the Re-Apply folder';
  end if;
  if is_store() and (new.payroll_completed_at is distinct from old.payroll_completed_at
                     or new.payroll_completed_by is distinct from old.payroll_completed_by) then
    raise exception 'Only HR can complete payroll';
  end if;
  return new;
end $$;
revoke all on function candidates_guard_workflow() from public, anon, authenticated;
drop trigger if exists candidates_guard_workflow on candidates;
create trigger candidates_guard_workflow before update on candidates for each row execute function candidates_guard_workflow();

-- ---------------------------------------------------------------------------
-- Admins get a copy of notifications meant for "admins".
-- ---------------------------------------------------------------------------
create or replace function notify_admins(p_sender text, p_message text) returns void
  language sql security definer set search_path = public as $$
  insert into notifications (sender, recipient, message)
  select p_sender, username, p_message from profiles where role in ('admin', 'superadmin')
$$;
revoke all on function notify_admins(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- /apply: underage / absconding re-applicants go to the Re-Apply folder instead of HR.
-- ---------------------------------------------------------------------------
create or replace function submit_application(p jsonb, p_secret text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  b branches;
  c candidates;
  v_mobile text := right(regexp_replace(coalesce(p ->> 'mobile', ''), '\D', '', 'g'), 10);
  v_name text := left(trim(coalesce(p ->> 'name', '')), 120);
  v_post text := left(trim(coalesce(p ->> 'post', '')), 120);
  v_folder uuid := nullif(p ->> 'folder', '')::uuid;
  v_form jsonb := coalesce(p -> 'form_data', '{}');
  v_consent text := nullif(left(trim(coalesce(p ->> 'consent_version', '')), 40), '');
  v_ref text := 'BAL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_src text := nullif(left(lower(regexp_replace(coalesce(p ->> 'source_channel', ''), '[^a-zA-Z0-9_-]', '', 'g')), 40), '');
  v_ref_by text := nullif(left(trim(coalesce(p ->> 'referred_by', '')), 120), '');
  v_review boolean;
  k text;
begin
  if not private.server_ok(p_secret) then return jsonb_build_object('status', 'forbidden'); end if;
  if v_mobile !~ '^[6-9][0-9]{9}$' then return jsonb_build_object('status', 'bad_mobile'); end if;
  if v_name = '' or v_post = '' then return jsonb_build_object('status', 'missing'); end if;
  if v_consent is null then return jsonb_build_object('status', 'no_consent'); end if;
  if length(v_form::text) > 20000 then return jsonb_build_object('status', 'too_big'); end if;
  select * into b from branches where id = nullif(p ->> 'branch_id', '')::uuid;
  if not found then return jsonb_build_object('status', 'bad_branch'); end if;
  if not coalesce((select (value -> b.id::text) ? v_post from app_settings where key = 'branch_posts'), false) then
    return jsonb_build_object('status', 'bad_post');
  end if;
  if (select count(*) from applications a join candidates x on x.id = a.candidate_id
      where x.mobile = v_mobile and a.submitted_at > now() - interval '1 day') >= 3 then
    return jsonb_build_object('status', 'too_many');
  end if;
  if v_folder is not null and not exists (select 1 from upload_folders where folder = v_folder and used_at is null) then
    return jsonb_build_object('status', 'bad_file');
  end if;
  for k in select key from jsonb_each_text(v_form) where value like 'app-file:%' loop
    if v_folder is null or (v_form ->> k) not like 'app-file:' || v_folder::text || '/%' then
      return jsonb_build_object('status', 'bad_file');
    end if;
  end loop;

  select * into c from candidates where mobile = v_mobile;
  if found and is_blacklisted(c) and not needs_reapply_review(c) then return jsonb_build_object('status', 'on_record'); end if;
  if v_folder is not null then update upload_folders set used_at = now() where folder = v_folder; end if;

  if found then
    v_review := needs_reapply_review(c) or c.reapply_review;
    perform set_config('app.trusted', 'on', true);
    update candidates set
      posts = case when v_post = any (posts) then posts else posts || v_post end,
      applied_locations = case when b.name = any (applied_locations) then applied_locations else applied_locations || b.name end,
      consent_version = v_consent, consented_at = now(),
      source_channel = coalesce(source_channel, v_src), referred_by = coalesce(referred_by, v_ref_by),
      reapply_review = v_review, reapply_at = case when v_review then now() else reapply_at end
    where id = c.id;
    insert into applications (ref, candidate_id, post, branch_id, form_data, folder, consent_version, source_channel, referred_by)
    values (v_ref, c.id, v_post, b.id, v_form, v_folder, v_consent, v_src, v_ref_by);
    if v_review then
      perform notify_admins('HR Portal', 'Re-Apply folder: ' || c.name || ' (' || v_mobile || ') applied again for ' || v_post || ' at ' || b.name
                                         || '. Previous: ' || coalesce(c.rejection_reason, c.pipeline_status) || '.');
      return jsonb_build_object('status', 'updated', 'ref', v_ref, 'notify', null);
    end if;
    insert into notifications (sender, recipient, message)
    values ('HR Portal', c.assigned_hr, c.name || ' (' || v_mobile || ') applied again: ' || v_post || ' at ' || b.name || ' (' || v_ref || ').');
    return jsonb_build_object('status', 'updated', 'ref', v_ref, 'notify', c.assigned_hr);
  end if;

  insert into candidates (source, name, mobile, marital_status, father_name, email, address, posts, applied_locations,
                          assigned_hr, received_at, form_data, application_folder, next_action, next_action_at,
                          consent_version, consented_at, source_channel, referred_by)
  values ('online', v_name, v_mobile,
          nullif(left(trim(p ->> 'marital_status'), 40), ''), nullif(left(trim(p ->> 'father_name'), 120), ''),
          nullif(left(trim(p ->> 'email'), 120), ''), nullif(left(trim(p ->> 'address'), 500), ''),
          array[v_post], array[b.name], b.hr_username, now(), v_form, v_folder,
          'Follow-up start immediately', now(), v_consent, now(), v_src, v_ref_by)
  returning * into c;
  insert into applications (ref, candidate_id, post, branch_id, form_data, folder, consent_version, source_channel, referred_by)
  values (v_ref, c.id, v_post, b.id, v_form, v_folder, v_consent, v_src, v_ref_by);
  insert into notifications (sender, recipient, message)
  values ('HR Portal', b.hr_username, 'New online application: ' || v_name || ' (' || v_mobile || ') for ' || v_post || ' at ' || b.name || ' (' || v_ref || ').');
  return jsonb_build_object('status', 'ok', 'ref', v_ref, 'notify', b.hr_username);
end $$;
revoke all on function submit_application(jsonb, text) from public;
grant execute on function submit_application(jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Starting a candidate over (admin enables a re-applicant, or approves a blocked walk-in).
-- The whole old row is kept in the history first, so nothing is lost.
-- ---------------------------------------------------------------------------
create or replace function restart_candidate(p_candidate uuid, p_patch jsonb, p_remark text) returns void
  language plpgsql security definer set search_path = public as $$
declare c candidates;
begin
  if not is_admin() then raise exception 'admin only'; end if;
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
    basic_salary = coalesce((p_patch ->> 'basic_salary')::numeric, 0),
    allowances = coalesce((p_patch ->> 'allowances')::numeric, 0),
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

-- Admin keeps a re-applicant closed: they leave the folder with their old status.
create or replace function dismiss_reapply(p_candidate uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  perform set_config('app.trusted', 'on', true);
  update candidates set reapply_review = false where id = p_candidate;
  insert into candidate_events (candidate_id, actor, stage, remark) values (p_candidate, (me()).username, 'reapply', 'Re-application not taken forward');
end $$;
revoke all on function dismiss_reapply(uuid) from public, anon;
grant execute on function dismiss_reapply(uuid) to authenticated;

-- Admin moves any closed candidate into the Re-Apply folder (e.g. an old "Age Criteria" who was really underage).
create or replace function send_to_reapply(p_candidate uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  perform set_config('app.trusted', 'on', true);
  update candidates set reapply_review = true, reapply_at = now() where id = p_candidate;
end $$;
revoke all on function send_to_reapply(uuid) from public, anon;
grant execute on function send_to_reapply(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Walk-ins of blocked people: the store asks, an admin decides.
-- ---------------------------------------------------------------------------
create table if not exists walkin_requests (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates (id) on delete cascade,
  branch_id    uuid not null references branches (id) on delete cascade,
  payload      jsonb not null,
  reason       text not null,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'refused')),
  requested_by text not null default (me()).username,
  decided_by   text,
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists walkin_requests_status on walkin_requests (status, created_at desc);
alter table walkin_requests enable row level security;
drop policy if exists walkin_requests_read on walkin_requests;
create policy walkin_requests_read on walkin_requests for select to authenticated
  using (is_admin() or requested_by = (me()).username);
drop policy if exists walkin_requests_admin on walkin_requests;
create policy walkin_requests_admin on walkin_requests for update to authenticated using (is_admin()) with check (is_admin());

-- The store can't see the blocked person's row, so the request is filed by this function.
create or replace function request_walkin_override(p_mobile text, p_branch uuid, p_payload jsonb) returns text
  language plpgsql security definer set search_path = public as $$
declare c candidates; b branches; v_reason text;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select * into c from candidates where mobile = right(regexp_replace(p_mobile, '\D', '', 'g'), 10);
  if not found then return 'not_found'; end if;
  select * into b from branches where id = p_branch;
  if not found then return 'bad_branch'; end if;
  if not (is_blacklisted(c) or needs_reapply_review(c) or c.reapply_review) then return 'not_blocked'; end if;
  if exists (select 1 from walkin_requests where candidate_id = c.id and status = 'pending') then return 'already'; end if;
  v_reason := coalesce(c.rejection_reason, c.pipeline_status);
  insert into walkin_requests (candidate_id, branch_id, payload, reason) values (c.id, b.id, p_payload, v_reason);
  perform notify_admins((me()).username, 'Walk-in approval needed: ' || c.name || ' (' || c.mobile || ') at ' || b.name
                                         || ' is blocked (' || v_reason || '). Open Admin > Walk-in approvals.');
  return 'ok';
end $$;
revoke all on function request_walkin_override(text, uuid, jsonb) from public, anon;
grant execute on function request_walkin_override(text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Missing Work: overdue Today's Work tasks, recorded every night at 11:55 pm IST.
-- ---------------------------------------------------------------------------
create table if not exists missed_work (
  id           bigint generated always as identity primary key,
  day          date not null,
  hr           text not null,
  candidate_id uuid references candidates (id) on delete cascade,
  candidate    text not null,
  task         text not null,
  due_at       timestamptz,
  status       text,
  unique (day, candidate_id)
);
create index if not exists missed_work_day on missed_work (day desc, hr);
alter table missed_work enable row level security;
drop policy if exists missed_work_admin on missed_work;
create policy missed_work_admin on missed_work for select to authenticated using (is_admin());

-- Active statuses whose next action is due today or earlier and was not done.
create or replace function overdue_work(p_day date) returns table (hr text, candidate_id uuid, candidate text, task text, due_at timestamptz, status text)
  language sql stable security definer set search_path = public as $$
  select c.assigned_hr, c.id, c.name || ' (' || c.mobile || ')', coalesce(c.next_action, 'Follow-up'), c.next_action_at, c.pipeline_status
  from candidates c
  where not c.reapply_review
    and c.next_action_at is not null
    and (c.next_action_at at time zone 'Asia/Kolkata')::date <= p_day
    and c.pipeline_status not like 'Left%'
    and c.pipeline_status not like 'Screening Rejected%'
    and c.pipeline_status not in ('Joined', 'Waiting for Admin Approval', 'Wrong Number', 'Not Contactable', 'Scheduled Not Contactable',
                                  'Interview Scheduled - No Response', 'Not Selected - Not Suitable', 'Interview Not Selected - Dropped by Candidate',
                                  'Interview Rescheduled Not Attended', 'Selected Candidate Dropped')
$$;
revoke all on function overdue_work(date) from public, anon, authenticated;

create or replace function record_missed_work() returns int
  language plpgsql security definer set search_path = public as $$
declare n int; d date := (now() at time zone 'Asia/Kolkata')::date;
begin
  insert into missed_work (day, hr, candidate_id, candidate, task, due_at, status)
  select d, o.hr, o.candidate_id, o.candidate, o.task, o.due_at, o.status from overdue_work(d) o
  on conflict (day, candidate_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function record_missed_work() from public, anon, authenticated;

-- What is overdue right now (admin report, before tonight's snapshot).
create or replace function overdue_now() returns table (hr text, candidate_id uuid, candidate text, task text, due_at timestamptz, status text)
  language sql stable security definer set search_path = public as $$
  select * from overdue_work((now() at time zone 'Asia/Kolkata')::date) where is_admin()
$$;
revoke all on function overdue_now() from public, anon;
grant execute on function overdue_now() to authenticated;

create extension if not exists pg_cron;
select cron.unschedule('missed-work') where exists (select 1 from cron.job where jobname = 'missed-work');
select cron.schedule('missed-work', '25 18 * * *', 'select public.record_missed_work()');  -- 18:25 UTC = 11:55 pm IST
