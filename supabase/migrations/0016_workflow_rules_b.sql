-- HR workflow rules, part B (varun's answers of 25 Oct 2026). Run after 0015. Adds columns and rules only; the one data
-- step marks salaries already on record as approved, so existing offer letters keep working.
--  * Re-Apply: screening rejections other than Not Suitable / over-age (salary, timing, distance, not interested)
--    now go to the admin's Re-Apply folder when they apply again, instead of being blocked for good.
--  * Salary: HR proposes basic + allowances, an admin approves (or edits) it; only an admin can set the real salary.
--    The offer letter opens once the salary is approved.
--  * Onboarding: files up to 5 MB; Aadhaar checked for free with the UIDAI Secure QR or offline e-KYC file
--    (the result is written by the portal's server only), or by HR in person.

-- ---------------------------------------------------------------------------
-- Blacklist and Re-Apply
-- ---------------------------------------------------------------------------
create or replace function is_blacklisted(c candidates) returns boolean
  language sql immutable as $$
  select coalesce(c.rejection_reason, '') not ilike '%Underage%'
     and coalesce(c.rejection_reason, '') ilike any (array['%Not Suitable%', '%Age Criteria%', '%Over Age%'])
$$;

create or replace function needs_reapply_review(c candidates) returns boolean
  language sql immutable as $$
  select not is_blacklisted(c) and (
         coalesce(c.rejection_reason, '') ilike '%Underage%'
      or (c.pipeline_status like 'Left%' and c.pipeline_status like '%Without Information%')
      or c.pipeline_status like 'Screening Rejected%')
$$;

-- ---------------------------------------------------------------------------
-- Salary: proposed by HR, approved by an admin
-- ---------------------------------------------------------------------------
alter table candidates add column if not exists proposed_basic numeric(12,2);
alter table candidates add column if not exists proposed_allowances numeric(12,2);
alter table candidates add column if not exists salary_status text check (salary_status in ('proposed', 'approved'));
alter table candidates add column if not exists salary_approved_by text;
alter table candidates add column if not exists salary_approved_at timestamptz;
create index if not exists candidates_salary_proposed on candidates (salary_status) where salary_status = 'proposed';

update candidates set salary_status = 'approved', salary_approved_by = 'before approval step', salary_approved_at = updated_at
where salary_status is null and (basic_salary > 0 or allowances > 0);

-- Staff (not admins) can only propose: a salary they type goes into proposed_*, never into the real columns.
create or replace function candidates_salary_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or current_setting('app.trusted', true) = 'on' or is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if coalesce(new.basic_salary, 0) > 0 or coalesce(new.allowances, 0) > 0 then
      new.proposed_basic := new.basic_salary; new.proposed_allowances := new.allowances; new.salary_status := 'proposed';
    end if;
    new.basic_salary := 0; new.allowances := 0;
    if new.salary_status = 'approved' then new.salary_status := null; end if;
    new.salary_approved_by := null; new.salary_approved_at := null;
    return new;
  end if;
  if new.basic_salary is distinct from old.basic_salary or new.allowances is distinct from old.allowances
     or new.salary_approved_by is distinct from old.salary_approved_by or new.salary_approved_at is distinct from old.salary_approved_at
     or (new.salary_status = 'approved' and old.salary_status is distinct from 'approved') then
    raise exception 'Only an admin can set or approve the salary. Enter it as a proposal.';
  end if;
  return new;
end $$;
revoke all on function candidates_salary_guard() from public, anon, authenticated;
drop trigger if exists candidates_salary_guard on candidates;
create trigger candidates_salary_guard before insert or update on candidates for each row execute function candidates_salary_guard();

-- Admins hear about each new proposal.
create or replace function candidates_salary_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.salary_status = 'proposed' and (tg_op = 'INSERT' or old.salary_status is distinct from 'proposed'
                                         or old.proposed_basic is distinct from new.proposed_basic
                                         or old.proposed_allowances is distinct from new.proposed_allowances) then
    perform notify_admins(coalesce((select username from profiles where id = auth.uid()), 'HR Portal'),
      'Salary approval needed: ' || new.name || ' (' || new.mobile || ') proposed ₹' || coalesce(new.proposed_basic, 0)
      || ' basic + ₹' || coalesce(new.proposed_allowances, 0) || ' allowances.');
  end if;
  return new;
end $$;
revoke all on function candidates_salary_notify() from public, anon, authenticated;
drop trigger if exists candidates_salary_notify on candidates;
create trigger candidates_salary_notify after insert or update on candidates for each row execute function candidates_salary_notify();

-- ---------------------------------------------------------------------------
-- Aadhaar check: written only by the portal's server (after it verified UIDAI's signature) or by HR in person.
-- Only what is needed to match the person is kept: name, birth date, gender, last 4 digits; never the full number.
-- ---------------------------------------------------------------------------
alter table candidates add column if not exists aadhaar_check jsonb;

create or replace function candidates_guard_aadhaar() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or current_setting('app.trusted', true) = 'on' or is_admin() then return new; end if;
  if new.aadhaar_check is distinct from old.aadhaar_check then
    raise exception 'The Aadhaar check is recorded by the portal, not edited by hand';
  end if;
  return new;
end $$;
revoke all on function candidates_guard_aadhaar() from public, anon, authenticated;
drop trigger if exists candidates_guard_aadhaar on candidates;
create trigger candidates_guard_aadhaar before update on candidates for each row execute function candidates_guard_aadhaar();

create or replace function record_aadhaar_check(p_token uuid, p_result jsonb, p_secret text) returns text
  language plpgsql security definer set search_path = public as $$
declare c candidates;
begin
  if not private.server_ok(p_secret) then return 'forbidden'; end if;
  select * into c from candidates where access_token = p_token;
  if not found then return 'invalid'; end if;
  if c.token_expires_at < now() then return 'expired'; end if;
  perform set_config('app.trusted', 'on', true);
  update candidates set aadhaar_check = jsonb_build_object(
      'method', p_result ->> 'method', 'name', left(p_result ->> 'name', 120), 'dob', left(p_result ->> 'dob', 20),
      'gender', left(p_result ->> 'gender', 10), 'last4', left(p_result ->> 'last4', 4), 'at', now())
  where id = c.id;
  return 'ok';
end $$;
revoke all on function record_aadhaar_check(uuid, jsonb, text) from public;
grant execute on function record_aadhaar_check(uuid, jsonb, text) to anon, authenticated;

-- HR saw the original Aadhaar in person.
create or replace function mark_aadhaar_seen(p_candidate uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare c candidates;
begin
  select * into c from candidates where id = p_candidate;
  if not found or not can_see_candidate(c) or is_store() then raise exception 'not allowed'; end if;
  perform set_config('app.trusted', 'on', true);
  update candidates set aadhaar_check = jsonb_build_object('method', 'in person', 'by', (me()).username, 'at', now()) where id = c.id;
end $$;
revoke all on function mark_aadhaar_seen(uuid) from public, anon;
grant execute on function mark_aadhaar_seen(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Candidate links also say whether the salary is approved and whether Aadhaar was checked.
-- ---------------------------------------------------------------------------
create or replace function candidate_by_token(p_token uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select case when c.token_expires_at < now() then jsonb_build_object('expired', true) else jsonb_build_object(
    'candidate', jsonb_build_object(
      'name', c.name, 'mobile', c.mobile, 'address', c.address, 'father_name', c.father_name,
      'marital_status', c.marital_status, 'email', c.email, 'posts', to_jsonb(c.posts),
      'applied_locations', to_jsonb(c.applied_locations), 'designation', c.designation,
      'basic_salary', c.basic_salary, 'allowances', c.allowances, 'pipeline_status', c.pipeline_status,
      'expected_joining_date', c.expected_joining_date, 'revised_joining_date', c.revised_joining_date,
      'actual_joining_date', c.actual_joining_date,
      'employment_status', c.employment_status, 'left_type', c.left_type, 'relieving_date', c.relieving_date,
      'confirmation_date', c.confirmation_date, 'offer_response', c.offer_response, 'offer_responded_at', c.offer_responded_at,
      'salary_status', c.salary_status, 'aadhaar_checked', c.aadhaar_check is not null),
    'branch', (select jsonb_build_object('name', b.name, 'address', b.address, 'business_type', b.business_type) from branches b
               where b.id = c.branch_id or (c.branch_id is null and b.name = c.applied_locations[1]) limit 1),
    'onboarding', (select jsonb_build_object('status', o.status, 'missing_docs', o.missing_docs)
                   from onboarding_submissions o where o.candidate_id = c.id)
  ) end
  from candidates c where c.access_token = p_token
$$;

-- The candidate can't answer an offer whose salary isn't approved yet.
create or replace function respond_offer(p_token uuid, p_accept boolean, p_reason text) returns text
  language plpgsql security definer set search_path = public as $$
declare c candidates;
begin
  select * into c from candidates where access_token = p_token;
  if not found then return 'invalid'; end if;
  if c.token_expires_at < now() then return 'expired'; end if;
  if c.salary_status is distinct from 'approved' then return 'not_ready'; end if;
  if c.offer_response is not null then return 'already'; end if;
  perform set_config('app.trusted', 'on', true);
  update candidates set offer_response = case when p_accept then 'accepted' else 'declined' end,
                        offer_responded_at = now(),
                        offer_decline_reason = case when p_accept then null else nullif(left(trim(coalesce(p_reason, '')), 300), '') end
  where id = c.id;
  insert into candidate_events (candidate_id, actor, stage, from_status, to_status, remark)
  values (c.id, c.name, 'offer', c.pipeline_status, c.pipeline_status,
          case when p_accept then 'Accepted the offer online' else 'Declined the offer online' || coalesce(': ' || nullif(trim(p_reason), ''), '') end);
  insert into notifications (sender, recipient, message)
  values (c.name, c.assigned_hr, c.name || ' (' || c.mobile || ') ' || case when p_accept then 'ACCEPTED' else 'declined' end || ' the offer online.');
  return 'ok';
end $$;
revoke all on function respond_offer(uuid, boolean, text) from public;
grant execute on function respond_offer(uuid, boolean, text) to anon, authenticated;

-- Onboarding uploads: 5 MB per file (phone photos are made smaller before upload).
update storage.buckets set file_size_limit = 5242880 where id = 'onboarding-docs';

-- Starting a candidate over (Re-Apply release, approved walk-in) also clears the old salary and Aadhaar check;
-- a salary typed for the new start goes in as a proposal.
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
