-- New features (second PR after the audit fixes):
--  * Source and referral tracking on /apply (?src=poster, careers page, "who referred you").
--  * Talent pool: good candidates kept for later openings, with tags.
--  * Online offer acceptance from the offer letter link.
--  * Interview scorecards.
--  * Manpower requests from branches, approved by admins, shown as "urgent" on the careers page.
--  * Push notification subscriptions (install-as-app).
--  * Confirmation date for the confirmation letter.

alter table candidates add column if not exists source_channel text;
alter table candidates add column if not exists referred_by text;
alter table candidates add column if not exists talent_pool boolean not null default false;
alter table candidates add column if not exists talent_tags text[] not null default '{}';
alter table candidates add column if not exists offer_response text check (offer_response in ('accepted', 'declined'));
alter table candidates add column if not exists offer_responded_at timestamptz;
alter table candidates add column if not exists offer_decline_reason text;
alter table candidates add column if not exists confirmation_date date;
alter table applications add column if not exists source_channel text;
alter table applications add column if not exists referred_by text;
create index if not exists candidates_talent_pool on candidates (talent_pool) where talent_pool;

-- Store and HR logins may not set the offer reply themselves (only the candidate's link can).
create or replace function candidates_guard_offer() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or current_setting('app.trusted', true) = 'on' or is_admin() then return new; end if;
  if new.offer_response is distinct from old.offer_response or new.offer_responded_at is distinct from old.offer_responded_at
     or new.source_channel is distinct from old.source_channel or new.referred_by is distinct from old.referred_by then
    raise exception 'Only the candidate can answer the offer, and only an admin can change the source or referral';
  end if;
  return new;
end $$;
revoke all on function candidates_guard_offer() from public, anon, authenticated;
drop trigger if exists candidates_guard_offer on candidates;
create trigger candidates_guard_offer before update on candidates for each row execute function candidates_guard_offer();

-- ---------------------------------------------------------------------------
-- /apply now records where the applicant came from and who referred them, and says whom to notify.
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
  -- at most 3 applications per mobile per day
  if (select count(*) from applications a join candidates x on x.id = a.candidate_id
      where x.mobile = v_mobile and a.submitted_at > now() - interval '1 day') >= 3 then
    return jsonb_build_object('status', 'too_many');
  end if;
  -- uploaded files must sit in a folder this server opened, not yet used
  if v_folder is not null and not exists (select 1 from upload_folders where folder = v_folder and used_at is null) then
    return jsonb_build_object('status', 'bad_file');
  end if;
  for k in select key from jsonb_each_text(v_form) where value like 'app-file:%' loop
    if v_folder is null or (v_form ->> k) not like 'app-file:' || v_folder::text || '/%' then
      return jsonb_build_object('status', 'bad_file');
    end if;
  end loop;

  select * into c from candidates where mobile = v_mobile;
  if found and is_blacklisted(c) then return jsonb_build_object('status', 'on_record'); end if;
  if v_folder is not null then update upload_folders set used_at = now() where folder = v_folder; end if;

  if found then
    update candidates set
      posts = case when v_post = any (posts) then posts else posts || v_post end,
      applied_locations = case when b.name = any (applied_locations) then applied_locations else applied_locations || b.name end,
      consent_version = v_consent, consented_at = now(),
      source_channel = coalesce(source_channel, v_src), referred_by = coalesce(referred_by, v_ref_by)
    where id = c.id;
    insert into applications (ref, candidate_id, post, branch_id, form_data, folder, consent_version, source_channel, referred_by)
    values (v_ref, c.id, v_post, b.id, v_form, v_folder, v_consent, v_src, v_ref_by);
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

-- ---------------------------------------------------------------------------
-- Candidate links also carry what the confirmation / relieving letters and the offer reply need.
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
      'confirmation_date', c.confirmation_date, 'offer_response', c.offer_response, 'offer_responded_at', c.offer_responded_at),
    'branch', (select jsonb_build_object('name', b.name, 'address', b.address, 'business_type', b.business_type) from branches b
               where b.id = c.branch_id or (c.branch_id is null and b.name = c.applied_locations[1]) limit 1),
    'onboarding', (select jsonb_build_object('status', o.status, 'missing_docs', o.missing_docs)
                   from onboarding_submissions o where o.candidate_id = c.id)
  ) end
  from candidates c where c.access_token = p_token
$$;

-- The candidate accepts or declines the offer from their offer letter link.
create or replace function respond_offer(p_token uuid, p_accept boolean, p_reason text) returns text
  language plpgsql security definer set search_path = public as $$
declare c candidates;
begin
  select * into c from candidates where access_token = p_token;
  if not found then return 'invalid'; end if;
  if c.token_expires_at < now() then return 'expired'; end if;
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

-- ---------------------------------------------------------------------------
-- Interview scorecards
-- ---------------------------------------------------------------------------
create table if not exists interview_scores (
  id             uuid primary key default gen_random_uuid(),
  candidate_id   uuid not null references candidates (id) on delete cascade,
  interviewer    text not null default (me()).username,
  ratings        jsonb not null default '{}',
  overall        int check (overall between 1 and 5),
  recommendation text not null check (recommendation in ('hire', 'hold', 'reject')),
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists interview_scores_candidate on interview_scores (candidate_id, created_at desc);
alter table interview_scores enable row level security;
drop policy if exists scores_read on interview_scores;
create policy scores_read on interview_scores for select to authenticated
  using (exists (select 1 from candidates c where c.id = candidate_id and can_see_candidate(c)));
drop policy if exists scores_insert on interview_scores;
create policy scores_insert on interview_scores for insert to authenticated
  with check (interviewer = (me()).username and exists (select 1 from candidates c where c.id = candidate_id and can_see_candidate(c)));
drop policy if exists scores_delete on interview_scores;
create policy scores_delete on interview_scores for delete to authenticated
  using (interviewer = (me()).username or is_admin());

-- ---------------------------------------------------------------------------
-- Manpower requests: a branch asks for people, an admin approves, HR fills.
-- ---------------------------------------------------------------------------
create table if not exists manpower_requests (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references branches (id) on delete cascade,
  post         text not null,
  headcount    int not null default 1 check (headcount between 1 and 50),
  needed_by    date,
  reason       text,
  status       text not null default 'requested' check (status in ('requested', 'approved', 'filled', 'cancelled')),
  requested_by text not null default (me()).username,
  decided_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists manpower_status on manpower_requests (status, branch_id);
alter table manpower_requests enable row level security;
drop policy if exists manpower_read on manpower_requests;
create policy manpower_read on manpower_requests for select to authenticated
  using (is_admin() or (me()).role = 'hr' or branch_id = (me()).branch_id);
drop policy if exists manpower_insert on manpower_requests;
create policy manpower_insert on manpower_requests for insert to authenticated
  with check (status = 'requested' and requested_by = (me()).username
              and (is_admin() or (me()).role = 'hr' or branch_id = (me()).branch_id));
drop policy if exists manpower_update on manpower_requests;
create policy manpower_update on manpower_requests for update to authenticated
  using (is_admin() or (requested_by = (me()).username and status = 'requested'))
  with check (is_admin() or status in ('requested', 'cancelled'));

-- What the public careers page shows: branches with open posts, and posts a branch urgently needs.
create or replace function public_careers() returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'urgent', coalesce((select jsonb_agg(jsonb_build_object('branch_id', m.branch_id, 'post', m.post, 'headcount', m.headcount))
                        from manpower_requests m where m.status = 'approved'), '[]'))
$$;
revoke all on function public_careers() from public;
grant execute on function public_careers() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Push notifications (when the portal is installed on a phone)
-- ---------------------------------------------------------------------------
create table if not exists push_subscriptions (
  endpoint   text primary key,
  username   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_user on push_subscriptions (username);
alter table push_subscriptions enable row level security;
drop policy if exists push_own on push_subscriptions;
create policy push_own on push_subscriptions for all to authenticated
  using (username = (me()).username) with check (username = (me()).username);

-- The server reads a recipient's subscriptions to send them a push. Gated by the server secret.
create or replace function push_targets(p_secret text, p_username text) returns setof push_subscriptions
  language sql stable security definer set search_path = public as $$
  select * from push_subscriptions where private.server_ok(p_secret) and username = p_username
$$;
create or replace function forget_push(p_secret text, p_endpoint text) returns void
  language sql security definer set search_path = public as $$
  delete from push_subscriptions where private.server_ok(p_secret) and endpoint = p_endpoint
$$;
revoke all on function push_targets(text, text) from public;
revoke all on function forget_push(text, text) from public;
grant execute on function push_targets(text, text) to anon, authenticated;
grant execute on function forget_push(text, text) to anon, authenticated;

-- Bulk downloads of personal data are recorded in the change history.
create or replace function log_export(p_rows int) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  perform log_change('candidates exported', null, jsonb_build_object('rows', p_rows));
end $$;
revoke all on function log_export(int) from public, anon;
grant execute on function log_export(int) to authenticated;
