-- Fix: brand-new online applicants who upload files could not submit ("Could not submit. Please try again.").
-- In 0015, `found` was read AFTER `update upload_folders ...`. In PL/pgSQL that UPDATE resets `found` to true,
-- so a first-time applicant was treated as an existing candidate, c.id was null, and the insert into
-- applications failed (null candidate_id). Now the candidate lookup result is saved in v_existing straight away.
-- Re-applicants and everything else behave exactly as before. Safe to run more than once.
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
  v_existing boolean;
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
  v_existing := found;
  if v_existing and is_blacklisted(c) and not needs_reapply_review(c) then return jsonb_build_object('status', 'on_record'); end if;
  if v_folder is not null then update upload_folders set used_at = now() where folder = v_folder; end if;

  if v_existing then
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
