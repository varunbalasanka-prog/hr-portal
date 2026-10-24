-- The app runs with the public (anon) key only. Everything that needs elevated rights
-- is a narrow SECURITY DEFINER function below, so no service-role key is deployed.

-- ---------------------------------------------------------------------------
-- Public candidate pages (letters, onboarding), looked up by secret token
-- ---------------------------------------------------------------------------
create or replace function candidate_by_token(p_token uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'candidate', to_jsonb(c) - 'form_data',
    'branch', (select to_jsonb(b) from branches b
               where b.id = c.branch_id or (c.branch_id is null and b.name = c.applied_locations[1]) limit 1),
    'onboarding', (select jsonb_build_object('status', o.status, 'missing_docs', o.missing_docs)
                   from onboarding_submissions o where o.candidate_id = c.id)
  )
  from candidates c where c.access_token = p_token
$$;
revoke all on function candidate_by_token(uuid) from public;
grant execute on function candidate_by_token(uuid) to anon, authenticated;

-- Onboarding is open while there is no submission yet, or HR marked it pending.
create or replace function onboarding_open(p_token text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from candidates c left join onboarding_submissions o on o.candidate_id = c.id
    where c.access_token::text = p_token and (o.id is null or o.status = 'pending'))
$$;
revoke all on function onboarding_open(text) from public;
grant execute on function onboarding_open(text) to anon, authenticated;

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
  select * into o from onboarding_submissions where candidate_id = c.id;
  if found and o.status <> 'pending' then return 'locked'; end if;

  -- only accept file paths inside this candidate's own folder
  for k in select jsonb_object_keys(coalesce(p_files, '{}')) loop
    if (p_files ->> k) not like p_token::text || '/%' then return 'bad_file'; end if;
  end loop;
  merged_files := coalesce(o.files, '{}') || coalesce(p_files, '{}');
  if not (merged_files ? 'aadhar' and merged_files ? 'school_certificate' and merged_files ? 'passport_photo') then
    return 'missing_docs';
  end if;

  insert into onboarding_submissions (candidate_id, status, missing_docs, details, files, submitted_at)
  values (c.id, 'submitted', '{}', coalesce(p_details, '{}'), merged_files, now())
  on conflict (candidate_id) do update
    set status = 'submitted', missing_docs = '{}', details = onboarding_submissions.details || excluded.details,
        files = excluded.files, submitted_at = now();

  update candidates set father_name = coalesce(father_name, nullif(p_details ->> 'father_name', '')),
                        email = coalesce(email, nullif(p_details ->> 'email', ''))
  where id = c.id;

  insert into notifications (sender, recipient, message)
  values (c.name, c.assigned_hr,
          'Onboarding documents ' || case when o.id is null then 'submitted' else 're-submitted' end
          || ' by ' || c.name || ' (' || c.mobile || '). Please verify.');
  return 'ok';
end $$;
revoke all on function submit_onboarding(uuid, jsonb, jsonb) from public;
grant execute on function submit_onboarding(uuid, jsonb, jsonb) to anon, authenticated;

-- Storage: candidates upload into "<their token>/..." while onboarding is open; staff read what they may see.
create policy onboarding_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'onboarding-docs' and onboarding_open((storage.foldername(name))[1]));
create policy onboarding_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'onboarding-docs' and exists (
    select 1 from candidates c where c.access_token::text = (storage.foldername(name))[1] and can_see_candidate(c)));

-- Staff may create a submission row only through submit_onboarding; admins can see all receipts.
create policy receipts_admin_read on notification_receipts for select to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- Accounts (passwords hashed with bcrypt inside Supabase Auth)
-- ---------------------------------------------------------------------------
create or replace function admin_set_password(p_user uuid, p_password text) returns void
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if length(p_password) < 8 then raise exception 'password must be at least 8 characters'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
  where id = p_user;
end $$;
revoke all on function admin_set_password(uuid, text) from public, anon;
grant execute on function admin_set_password(uuid, text) to authenticated;

-- Used by the database owner only (setup / adding staff from the SQL editor).
create or replace function create_staff_user(p_username text, p_full_name text, p_role user_role, p_branch uuid, p_email text, p_password text)
  returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', lower(p_email),
          extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text,
          jsonb_build_object('sub', uid::text, 'email', lower(p_email), 'email_verified', true), 'email', now(), now(), now());
  insert into profiles (id, username, full_name, role, branch_id) values (uid, p_username, p_full_name, p_role, p_branch);
  return uid;
end $$;
revoke all on function create_staff_user(text, text, user_role, uuid, text, text) from public, anon, authenticated;
