-- Confirmation letters after probation:
--  * The nightly job alerts the employee's HR 7 days before the confirmation date (the 1st after the 6-month probation).
--  * HR approves; only then does the confirmation letter open, and on the 1st it appears in HR's SMS list to send.
-- Run once in the Supabase SQL editor.

alter table candidates add column if not exists confirmation_approved_by text;
alter table candidates add column if not exists confirmation_approved_at timestamptz;
alter table candidates add column if not exists confirmation_alerted_at timestamptz;

-- Same rule as probationEnd() in lib/dates.ts, plus one day: joined on the 1st -> the 1st six months later,
-- otherwise the 1st of the month after the sixth month.
create or replace function confirmation_due_date(p_doj date) returns date
  language sql immutable as $$
  select case when extract(day from p_doj) = 1 then (p_doj + interval '6 months')::date
         else (date_trunc('month', p_doj + interval '6 months') + interval '1 month')::date end
$$;

-- Staff can't mark a confirmation approved by editing the row; they use approve_confirmation().
create or replace function candidates_guard_confirmation() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if not (auth.uid() is null or coalesce(current_setting('app.trusted', true), '') = 'on' or is_admin())
     and (new.confirmation_approved_by is distinct from old.confirmation_approved_by
          or new.confirmation_approved_at is distinct from old.confirmation_approved_at
          or new.confirmation_alerted_at is distinct from old.confirmation_alerted_at) then
    raise exception 'Use the Approve confirmation button';
  end if;
  -- A new joining date (rejoined, or corrected) starts the confirmation over.
  if new.actual_joining_date is distinct from old.actual_joining_date then
    if old.confirmation_approved_at is not null and new.confirmation_date is not distinct from old.confirmation_date then
      new.confirmation_date := null; -- it was worked out from the old joining date
    end if;
    new.confirmation_approved_by := null; new.confirmation_approved_at := null; new.confirmation_alerted_at := null;
  end if;
  return new;
end $$;
revoke all on function candidates_guard_confirmation() from public, anon, authenticated;
drop trigger if exists candidates_guard_confirmation on candidates;
create trigger candidates_guard_confirmation before update on candidates for each row execute function candidates_guard_confirmation();

-- HR (or an admin) approves. The link is kept working for 60 days after the letter is due, since the
-- original link from joining has usually expired by then.
create or replace function approve_confirmation(p_candidate uuid) returns date
  language plpgsql security definer set search_path = public as $$
declare c candidates; d date;
begin
  select * into c from candidates where id = p_candidate;
  if not found or not can_see_candidate(c) or is_store() then raise exception 'not allowed'; end if;
  if c.pipeline_status <> 'Joined' or c.actual_joining_date is null or coalesce(c.employment_status, '') = 'Left' then
    raise exception 'Only a working employee can be confirmed';
  end if;
  d := coalesce(c.confirmation_date, confirmation_due_date(c.actual_joining_date));
  perform set_config('app.trusted', 'on', true);
  update candidates set confirmation_date = d, confirmation_approved_by = (me()).username, confirmation_approved_at = now(),
    token_expires_at = greatest(token_expires_at, now() + interval '60 days', (d + 60)::timestamptz)
  where id = c.id;
  insert into candidate_events (candidate_id, actor, stage, from_status, to_status, remark)
  values (c.id, (me()).username, 'confirmation', c.pipeline_status, c.pipeline_status,
          'Confirmation approved, effective ' || to_char(d, 'DD/MM/YYYY'));
  return d;
end $$;
revoke all on function approve_confirmation(uuid) from public, anon;
grant execute on function approve_confirmation(uuid) to authenticated;

-- Nightly: tell each HR about employees whose confirmation is due (once per employee). Probations that ended more
-- than p_backlog_days ago are skipped: those staff were confirmed on paper before the portal did this.
create or replace function send_confirmation_alerts(p_days_before int, p_backlog_days int)
  returns table (hr text, candidate text, mobile text, due date)
  language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'Asia/Kolkata')::date; r record;
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  perform set_config('app.trusted', 'on', true);
  for r in
    select x.* from (
      select c.id, c.assigned_hr, c.name, c.mobile, coalesce(c.confirmation_date, confirmation_due_date(c.actual_joining_date)) as d
      from candidates c
      where c.pipeline_status = 'Joined' and c.actual_joining_date is not null and coalesce(c.employment_status, '') <> 'Left'
        and c.confirmation_approved_at is null and c.confirmation_alerted_at is null
    ) x
    where today >= x.d - p_days_before and x.d >= today - p_backlog_days
  loop
    update candidates set confirmation_alerted_at = now() where id = r.id;
    insert into notifications (sender, recipient, message)
    values ('system', r.assigned_hr, 'Confirmation due: ' || r.name || ' (' || r.mobile || ') completes probation and is confirmed from '
            || to_char(r.d, 'DD/MM/YYYY') || '. Open "Confirmations to approve" and approve it so the letter can be sent.');
    hr := r.assigned_hr; candidate := r.name; mobile := r.mobile; due := r.d;
    return next;
  end loop;
end $$;
revoke all on function send_confirmation_alerts(int, int) from public, anon;
grant execute on function send_confirmation_alerts(int, int) to authenticated;

-- Candidate links also say whether the confirmation is approved (the letter opens only then).
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
      'confirmation_date', c.confirmation_date, 'confirmation_approved_at', c.confirmation_approved_at,
      'offer_response', c.offer_response, 'offer_responded_at', c.offer_responded_at,
      'salary_status', c.salary_status, 'aadhaar_checked', c.aadhaar_check is not null),
    'branch', (select jsonb_build_object('name', b.name, 'address', b.address, 'business_type', b.business_type) from branches b
               where b.id = c.branch_id or (c.branch_id is null and b.name = c.applied_locations[1]) limit 1),
    'onboarding', (select jsonb_build_object('status', o.status, 'missing_docs', o.missing_docs)
                   from onboarding_submissions o where o.candidate_id = c.id)
  ) end
  from candidates c where c.access_token = p_token
$$;
