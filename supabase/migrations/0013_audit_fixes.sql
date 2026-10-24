-- Fixes from the 24 Oct 2026 audit (everything except the salary formula).
--  * Applications: only the portal's server can open an upload folder or submit (server secret), with rate limits.
--    Files go from the browser straight to storage, so phone photos no longer hit Vercel's 4.5 MB request cap.
--    Every submission is kept as its own row in `applications`; a known mobile no longer loses its new answers.
--  * Consent: the privacy notice version and time are saved with each application and onboarding submission.
--  * Candidates: store and HR logins can't change protected columns; every candidate edit is in the change history.
--  * Candidate links expire (60 days, renewable) and return only what the letters and onboarding form show.
--  * Storage rules for avatars and notification files are per person; admins can delete files (erase, clean-up).
--  * Admin roles need two-step login once they have set it up (is_admin checks the session's assurance level).
--  * Data: posts per store by business type, branch name typos, "Left" statuses without the date inside.

-- ---------------------------------------------------------------------------
-- Server secret. The website's server sends APPLY_SECRET; only its SHA-256 lives here, in a schema the API can't see.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);
insert into private.settings (key, value)
values ('apply_secret_sha256', 'c3c139babf84e25a930a04cab470cf0f9af1be9241dab6d914064618606f3596')
on conflict (key) do update set value = excluded.value;

create or replace function private.server_ok(p_secret text) returns boolean
  language sql stable security definer set search_path = public, extensions as $$
  select coalesce(encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex')
                  = (select value from private.settings where key = 'apply_secret_sha256'), false)
$$;
revoke all on function private.server_ok(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Upload folders for /apply: the server opens one per applicant, the browser uploads into it, submit closes it.
-- ---------------------------------------------------------------------------
create table if not exists upload_folders (
  folder     uuid primary key default gen_random_uuid(),
  ip_hash    text,
  created_at timestamptz not null default now(),
  used_at    timestamptz
);
create index if not exists upload_folders_created on upload_folders (created_at);
create index if not exists upload_folders_ip on upload_folders (ip_hash, created_at);
alter table upload_folders enable row level security;  -- no policies: only the functions below touch it

-- Returns {"folder": "<uuid>"} or {"error": "forbidden" | "too_many" | "busy"}.
create or replace function open_apply_folder(p_secret text, p_ip text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare f uuid;
begin
  if not private.server_ok(p_secret) then return jsonb_build_object('error', 'forbidden'); end if;
  if (select count(*) from upload_folders where ip_hash = p_ip and created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('error', 'too_many');
  end if;
  if (select count(*) from upload_folders where created_at > now() - interval '1 hour') >= 300 then
    return jsonb_build_object('error', 'busy');
  end if;
  insert into upload_folders (ip_hash) values (left(p_ip, 64)) returning folder into f;
  return jsonb_build_object('folder', f);
end $$;
revoke all on function open_apply_folder(text, text) from public;
grant execute on function open_apply_folder(text, text) to anon, authenticated;

-- A folder takes uploads for 2 hours after it was opened, until it is submitted, and at most 8 files.
create or replace function apply_folder_open(p_folder text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from upload_folders where folder::text = p_folder and used_at is null and created_at > now() - interval '2 hours')
     and (select count(*) from storage.objects where bucket_id = 'applications' and (storage.foldername(name))[1] = p_folder) < 8
$$;
revoke all on function apply_folder_open(text) from public;
grant execute on function apply_folder_open(text) to anon, authenticated;

drop policy if exists apply_upload on storage.objects;
create policy apply_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'applications' and apply_folder_open((storage.foldername(name))[1]));

-- ---------------------------------------------------------------------------
-- Each submission is its own row; the candidate row is the person.
-- ---------------------------------------------------------------------------
create table if not exists applications (
  id              uuid primary key default gen_random_uuid(),
  ref             text not null unique,
  candidate_id    uuid not null references candidates (id) on delete cascade,
  post            text not null,
  branch_id       uuid references branches (id) on delete set null,
  form_data       jsonb not null default '{}',
  folder          uuid,
  consent_version text,
  submitted_at    timestamptz not null default now()
);
create index if not exists applications_candidate on applications (candidate_id, submitted_at desc);
create index if not exists applications_folder on applications (folder);
alter table applications enable row level security;
drop policy if exists applications_read on applications;
create policy applications_read on applications for select to authenticated
  using (exists (select 1 from candidates c where c.id = candidate_id and can_see_candidate(c)));

alter table candidates add column if not exists consent_version text;
alter table candidates add column if not exists consented_at timestamptz;
alter table onboarding_submissions add column if not exists consent_version text;

drop policy if exists apply_staff_read on storage.objects;
create policy apply_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'applications' and (
    exists (select 1 from candidates c where c.application_folder::text = (storage.foldername(name))[1] and can_see_candidate(c))
    or exists (select 1 from applications a join candidates c on c.id = a.candidate_id
               where a.folder::text = (storage.foldername(name))[1] and can_see_candidate(c))));

-- The old one-argument version could be called by anyone with the public key.
drop function if exists submit_application(jsonb);

-- Returns {"status": "ok" | "updated", "ref": "BAL-XXXXXX"} or {"status": "<error code>"}.
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
      consent_version = v_consent, consented_at = now()
    where id = c.id;
    insert into applications (ref, candidate_id, post, branch_id, form_data, folder, consent_version)
    values (v_ref, c.id, v_post, b.id, v_form, v_folder, v_consent);
    insert into notifications (sender, recipient, message)
    values ('HR Portal', c.assigned_hr, c.name || ' (' || v_mobile || ') applied again: ' || v_post || ' at ' || b.name || ' (' || v_ref || ').');
    return jsonb_build_object('status', 'updated', 'ref', v_ref);
  end if;

  insert into candidates (source, name, mobile, marital_status, father_name, email, address, posts, applied_locations,
                          assigned_hr, received_at, form_data, application_folder, next_action, next_action_at,
                          consent_version, consented_at)
  values ('online', v_name, v_mobile,
          nullif(left(trim(p ->> 'marital_status'), 40), ''), nullif(left(trim(p ->> 'father_name'), 120), ''),
          nullif(left(trim(p ->> 'email'), 120), ''), nullif(left(trim(p ->> 'address'), 500), ''),
          array[v_post], array[b.name], b.hr_username, now(), v_form, v_folder,
          'Follow-up start immediately', now(), v_consent, now())
  returning * into c;
  insert into applications (ref, candidate_id, post, branch_id, form_data, folder, consent_version)
  values (v_ref, c.id, v_post, b.id, v_form, v_folder, v_consent);
  insert into notifications (sender, recipient, message)
  values ('HR Portal', b.hr_username, 'New online application: ' || v_name || ' (' || v_mobile || ') for ' || v_post || ' at ' || b.name || ' (' || v_ref || ').');
  return jsonb_build_object('status', 'ok', 'ref', v_ref);
end $$;
revoke all on function submit_application(jsonb, text) from public;
grant execute on function submit_application(jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Candidate links: expire after 60 days unless HR renews them; return only what the pages show.
-- ---------------------------------------------------------------------------
alter table candidates add column if not exists token_expires_at timestamptz not null default now() + interval '60 days';

-- {"expired": true} for an old link, null for an unknown one.
create or replace function candidate_by_token(p_token uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select case when c.token_expires_at < now() then jsonb_build_object('expired', true) else jsonb_build_object(
    'candidate', jsonb_build_object(
      'name', c.name, 'mobile', c.mobile, 'address', c.address, 'father_name', c.father_name,
      'marital_status', c.marital_status, 'email', c.email, 'posts', to_jsonb(c.posts),
      'applied_locations', to_jsonb(c.applied_locations), 'designation', c.designation,
      'basic_salary', c.basic_salary, 'allowances', c.allowances, 'pipeline_status', c.pipeline_status,
      'expected_joining_date', c.expected_joining_date, 'revised_joining_date', c.revised_joining_date,
      'actual_joining_date', c.actual_joining_date),
    'branch', (select jsonb_build_object('name', b.name, 'address', b.address, 'business_type', b.business_type) from branches b
               where b.id = c.branch_id or (c.branch_id is null and b.name = c.applied_locations[1]) limit 1),
    'onboarding', (select jsonb_build_object('status', o.status, 'missing_docs', o.missing_docs)
                   from onboarding_submissions o where o.candidate_id = c.id)
  ) end
  from candidates c where c.access_token = p_token
$$;

create or replace function onboarding_open(p_token text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from candidates c left join onboarding_submissions o on o.candidate_id = c.id
    where c.access_token::text = p_token and c.token_expires_at > now() and (o.id is null or o.status = 'pending'))
$$;

create or replace function submit_onboarding(p_token uuid, p_details jsonb, p_files jsonb) returns text
  language plpgsql security definer set search_path = public as $$
declare
  c candidates;
  o onboarding_submissions;
  merged_files jsonb;
  k text;
begin
  select * into c from candidates where access_token = p_token;
  if not found then return 'invalid'; end if;
  if c.token_expires_at < now() then return 'expired'; end if;
  if nullif(p_details ->> 'consent_version', '') is null then return 'no_consent'; end if;
  select * into o from onboarding_submissions where candidate_id = c.id;
  if found and o.status <> 'pending' then return 'locked'; end if;

  for k in select jsonb_object_keys(coalesce(p_files, '{}')) loop
    if (p_files ->> k) not like p_token::text || '/%' then return 'bad_file'; end if;
  end loop;
  merged_files := coalesce(o.files, '{}') || coalesce(p_files, '{}');
  if not (merged_files ? 'aadhar' and merged_files ? 'school_certificate' and merged_files ? 'passport_photo') then
    return 'missing_docs';
  end if;

  insert into onboarding_submissions (candidate_id, status, missing_docs, details, files, submitted_at, consent_version)
  values (c.id, 'submitted', '{}', coalesce(p_details, '{}'), merged_files, now(), p_details ->> 'consent_version')
  on conflict (candidate_id) do update
    set status = 'submitted', missing_docs = '{}', details = onboarding_submissions.details || excluded.details,
        files = excluded.files, submitted_at = now(), consent_version = excluded.consent_version;

  perform set_config('app.trusted', 'on', true);
  update candidates set father_name = coalesce(father_name, nullif(p_details ->> 'father_name', '')),
                        email = coalesce(email, nullif(p_details ->> 'email', ''))
  where id = c.id;

  insert into notifications (sender, recipient, message)
  values (c.name, c.assigned_hr,
          'Onboarding documents ' || case when o.id is null then 'submitted' else 're-submitted' end
          || ' by ' || c.name || ' (' || c.mobile || '). Please verify.');
  return 'ok';
end $$;

-- Staff renew a link (60 more days) or replace it (the old link stops working).
create or replace function renew_candidate_link(p_candidate uuid, p_replace boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare c candidates;
begin
  select * into c from candidates where id = p_candidate;
  if not found or not can_see_candidate(c) then raise exception 'candidate not found'; end if;
  perform set_config('app.trusted', 'on', true);
  update candidates set token_expires_at = now() + interval '60 days',
                        access_token = case when p_replace then gen_random_uuid() else access_token end
  where id = p_candidate;
end $$;
revoke all on function renew_candidate_link(uuid, boolean) from public, anon;
grant execute on function renew_candidate_link(uuid, boolean) to authenticated;

-- Onboarding files are read by the paths saved on the submission, so replacing a link keeps them visible.
drop policy if exists onboarding_staff_read on storage.objects;
create policy onboarding_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'onboarding-docs' and exists (
    select 1 from onboarding_submissions o join candidates c on c.id = o.candidate_id
    where can_see_candidate(c) and (name in (select value from jsonb_each_text(o.files))
                                    or c.access_token::text = (storage.foldername(name))[1])));

-- ---------------------------------------------------------------------------
-- Two-step login: once a login has a verified authenticator, admin powers need a session that used it.
-- ---------------------------------------------------------------------------
create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'superadmin') from profiles where id = auth.uid()), false)
     and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
          or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'))
$$;

create or replace function is_super_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'superadmin' from profiles where id = auth.uid()), false)
     and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
          or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'))
$$;

-- Admins see every candidate only with a full-strength session too.
create or replace function can_see_candidate(c candidates) returns boolean
  language sql stable security definer set search_path = public as $$
  select case
    when p.role in ('admin', 'superadmin') then is_admin()
    when p.role = 'hr' then c.assigned_hr = p.username
    when p.role = 'branch' then (c.branch_id = p.branch_id
        or exists (select 1 from branches b where b.id = p.branch_id and b.name = any (c.applied_locations)))
      and (c.source = 'walkin' or c.pipeline_status <> 'Follow-up Not Started')
    else false end
  from profiles p where p.id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Candidates: who may insert, which columns staff may change, and a history of every change.
-- ---------------------------------------------------------------------------
alter policy candidates_insert on candidates
  with check (is_admin() or (source = 'walkin' and entry_by = (me()).username));

create or replace function candidates_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- the SQL editor, database functions marked trusted, the public submit functions, and admins
  if auth.uid() is null or current_setting('app.trusted', true) = 'on' or is_admin() then return new; end if;
  if new.assigned_hr is distinct from old.assigned_hr or new.source is distinct from old.source
     or new.mobile is distinct from old.mobile or new.access_token is distinct from old.access_token
     or new.token_expires_at is distinct from old.token_expires_at or new.form_data is distinct from old.form_data
     or new.application_folder is distinct from old.application_folder or new.entry_by is distinct from old.entry_by
     or new.received_at is distinct from old.received_at or new.created_at is distinct from old.created_at
     or new.consent_version is distinct from old.consent_version or new.consented_at is distinct from old.consented_at then
    raise exception 'Only an admin can change the HR, source, mobile, link or application answers of a candidate';
  end if;
  return new;
end $$;
revoke all on function candidates_guard() from public, anon, authenticated;
drop trigger if exists candidates_guard on candidates;
create trigger candidates_guard before update on candidates for each row execute function candidates_guard();

-- Candidate history is keyed by id so erasing a person can also remove their history.
create or replace function audit_candidate() returns trigger
  language plpgsql security definer set search_path = public as $$
declare diff jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_object('from', to_jsonb(old) -> k, 'to', to_jsonb(new) -> k)) into diff
    from jsonb_object_keys(to_jsonb(new)) k
    where k not in ('updated_at', 'form_data') and (to_jsonb(old) -> k) is distinct from (to_jsonb(new) -> k);
    if diff is null then return new; end if;
    perform log_change('candidate update', new.id::text, jsonb_build_object('name', new.name) || diff);
    return new;
  end if;
  perform log_change('candidate delete', old.id::text, jsonb_build_object('source', old.source, 'received_at', old.received_at));
  return old;
end $$;
revoke all on function audit_candidate() from public, anon, authenticated;
drop trigger if exists audit on candidates;
create trigger audit after update or delete on candidates for each row execute function audit_candidate();

-- ---------------------------------------------------------------------------
-- Privacy: erase a person (super admin), and strip closed records untouched for 12 months (admins can change the months).
-- ---------------------------------------------------------------------------
insert into app_settings (key, value) values
  ('privacy_contact', '{"name": "HR Department, Balasanka Group of Companies", "phone": "", "email": "", "address": "Theni, Tamil Nadu"}'),
  ('retention_months', '12')
on conflict (key) do nothing;

-- Storage paths that belong to a candidate (application uploads and onboarding documents).
create or replace function candidate_files(p_candidate uuid) returns table (bucket text, path text)
  language sql stable security definer set search_path = public as $$
  select o.bucket_id, o.name from storage.objects o, candidates c
  where c.id = p_candidate and is_admin() and (
       (o.bucket_id = 'applications' and (storage.foldername(o.name))[1] in (
          select c.application_folder::text union select a.folder::text from applications a where a.candidate_id = c.id))
    or (o.bucket_id = 'onboarding-docs' and (
          (storage.foldername(o.name))[1] = c.access_token::text
          or o.name in (select value from onboarding_submissions s, jsonb_each_text(s.files) where s.candidate_id = c.id))))
$$;
revoke all on function candidate_files(uuid) from public, anon;
grant execute on function candidate_files(uuid) to authenticated;

-- Deletes the person and their history. Files are deleted by the server first (storage API).
create or replace function erase_candidate(p_candidate uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_super_admin() then
    raise exception 'only the super admin can erase a person';
  end if;
  delete from audit_log where target = p_candidate::text;
  delete from candidates where id = p_candidate;  -- events, onboarding and applications go with it
  perform log_change('candidate erased', p_candidate::text, null);
end $$;
revoke all on function erase_candidate(uuid) from public, anon;
grant execute on function erase_candidate(uuid) to authenticated;

-- Closed (rejected, dropped, left) candidates not touched for p_months: keep name, mobile and status so the
-- blacklist still works, remove everything else. Returns their ids; the caller deletes their files first (dry run),
-- then calls again with p_dry_run = false.
create or replace function strip_old_candidates(p_months int, p_dry_run boolean) returns setof uuid
  language plpgsql security definer set search_path = public as $$
declare ids uuid[];
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if p_months is null or p_months < 6 then raise exception 'keep at least 6 months'; end if;
  select coalesce(array_agg(id), '{}') into ids from candidates
  where updated_at < now() - make_interval(months => p_months)
    and (pipeline_status like 'Left%' or pipeline_status in
         ('Wrong Number', 'Not Contactable', 'Screening Rejected', 'Selected Candidate Dropped', 'Not Selected - Not Suitable',
          'Interview Not Selected - Dropped by Candidate', 'Interview Scheduled - No Response', 'Interview Rescheduled Not Attended'))
    and (address is not null or father_name is not null or email is not null or form_data <> '{}'
         or exists (select 1 from applications a where a.candidate_id = candidates.id and a.form_data <> '{}')
         or exists (select 1 from onboarding_submissions o where o.candidate_id = candidates.id));
  if not p_dry_run and cardinality(ids) > 0 then
    perform set_config('app.trusted', 'on', true);
    update candidates set address = null, father_name = null, email = null, form_data = '{}' where id = any (ids);
    update applications set form_data = '{}' where candidate_id = any (ids);
    delete from onboarding_submissions where candidate_id = any (ids);
    delete from audit_log where target in (select unnest(ids)::text) and action = 'candidate update';
    perform log_change('old records stripped', null, jsonb_build_object('count', cardinality(ids), 'months', p_months));
  end if;
  return query select unnest(ids);
end $$;
revoke all on function strip_old_candidates(int, boolean) from public, anon;
grant execute on function strip_old_candidates(int, boolean) to authenticated;

-- Admins (and the clean-up account) may delete application and onboarding files.
drop policy if exists admin_delete_candidate_files on storage.objects;
create policy admin_delete_candidate_files on storage.objects for delete to authenticated
  using (bucket_id in ('applications', 'onboarding-docs') and is_admin());
drop policy if exists admin_read_candidate_files on storage.objects;
create policy admin_read_candidate_files on storage.objects for select to authenticated
  using (bucket_id in ('applications', 'onboarding-docs') and is_admin());

-- Upload folders that were opened but never submitted, older than a day.
create or replace function stale_upload_folders() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select folder from upload_folders where used_at is null and created_at < now() - interval '1 day' and is_admin()
$$;
create or replace function forget_upload_folders(p_folders uuid[]) returns void
  language sql security definer set search_path = public as $$
  delete from upload_folders where folder = any (p_folders) and used_at is null and is_admin()
$$;
revoke all on function stale_upload_folders() from public, anon;
revoke all on function forget_upload_folders(uuid[]) from public, anon;
grant execute on function stale_upload_folders() to authenticated;
grant execute on function forget_upload_folders(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Avatars and notification files: each person writes only their own folder.
-- ---------------------------------------------------------------------------
drop policy if exists notif_files_rw on storage.objects;
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select to authenticated using (bucket_id = 'avatars');
drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists notif_files_write on storage.objects;
create policy notif_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'notification-files' and (storage.foldername(name))[1] = (me()).username);
drop policy if exists notif_files_read on storage.objects;
create policy notif_files_read on storage.objects for select to authenticated
  using (bucket_id = 'notification-files' and ((storage.foldername(name))[1] = (me()).username or is_admin()
         or exists (select 1 from notifications n where n.file_path = name and n.recipient = (me()).username)));

-- ---------------------------------------------------------------------------
-- Advisor clean-ups
-- ---------------------------------------------------------------------------
drop function if exists public._import_candidates(jsonb);
create index if not exists profiles_branch_idx on profiles (branch_id);
alter policy profiles_self_update on profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = (select role from profiles where id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Data
-- ---------------------------------------------------------------------------
-- Branch name typos; applied_locations keeps branch names, so it moves with them.
do $$
declare r record;
begin
  for r in select * from (values
    ('Balsanka Cycle - Theni', 'Balasanka Cycle - Theni'),
    ('Yasotha Motors Theni', 'Yasotha Motors - Theni'),
    ('Akshaya velli - Rajapalayam', 'Akshaya Velli - Rajapalayam'),
    ('Akshaya velli - Tirunelveli', 'Akshaya Velli - Tirunelveli')) t(old_name, new_name)
  loop
    update branches set name = r.new_name where name = r.old_name;
    update candidates set applied_locations = array_replace(applied_locations, r.old_name, r.new_name)
    where r.old_name = any (applied_locations);
  end loop;
end $$;

-- "Left (Without Information on 2026-10-15)" -> status "Left (Without Information)" and the date in relieving_date.
update candidates
set relieving_date = coalesce(relieving_date, substring(pipeline_status from '(\d{4}-\d{2}-\d{2})\)$')::date),
    pipeline_status = regexp_replace(pipeline_status, ' on \d{4}-\d{2}-\d{2}\)$', ')')
where pipeline_status ~ '^Left \(.* on \d{4}-\d{2}-\d{2}\)$';

-- Posts per store by business type (admins can change any store in Admin > Posts open at each store).
update app_settings set value = (
  select jsonb_object_agg(b.id::text, case when b.business_type = 'Automobiles'
    then '["Executive Sales", "Store Manager", "Cashier", "Executive Accounts", "Data Entry Operator", "Customer Care Executive",
           "Customer Care Manager", "Receptionist", "HR Executive", "Digital Marketing", "Service Advisor", "Manager Service",
           "Manager Spares", "Technician", "Assistant Technician", "Incharge PDI", "Electrician", "Helper", "House Keeping"]'::jsonb
    else '["Executive Sales", "Retail Sales Officer", "Jewellery Consultant", "Floor Supervisor", "Store Manager", "Cashier",
           "Executive Accounts", "Data Entry Operator", "Customer Care Executive", "Customer Care Manager", "Receptionist",
           "HR Executive", "Digital Marketing", "Helper", "House Keeping"]'::jsonb end)
  from branches b), updated_at = now()
where key = 'branch_posts';

-- Educational qualification becomes a list, so it can be filtered later. Past answers keep their text.
update application_questions
set type = 'choice', updated_at = now(), options = array[
  '8th or below / 8ஆம் வகுப்பு அல்லது குறைவு', '10th (SSLC) / 10ஆம் வகுப்பு', '12th (HSC) / 12ஆம் வகுப்பு', 'ITI / ஐடிஐ',
  'Diploma / டிப்ளமோ', 'Degree / இளநிலைப் பட்டம்', 'Post-graduate / முதுநிலைப் பட்டம்', 'Other / மற்றவை']
where active and label like 'Educational qualification%' and type = 'text';

-- What the public /privacy page shows.
create or replace function public_privacy_info() returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'contact', (select value from app_settings where key = 'privacy_contact'),
    'retention_months', (select value from app_settings where key = 'retention_months'))
$$;
revoke all on function public_privacy_info() from public;
grant execute on function public_privacy_info() to anon, authenticated;
