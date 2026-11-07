-- Shorter apply page (varun, 7 Nov 2026): before the interview, applicants answer only the basics.
-- Everything else moves to an "after-interview details" link (/details/<link>) that only interview-selected
-- (or on-hold) candidates fill.
--
-- * application_questions.ask_at: 'apply' (the /apply page) or 'after_interview' (the details link).
--   Admins switch it per question in Admin > Application form.
-- * A new required "Age" question on the apply page (18+). Date of birth moves to after the interview.
-- * Gender, experience, salary and resume questions move to after the interview.
-- * Passport photo leaves the apply page: the onboarding form already asks for it (it can be restored in Admin).
-- * Answers from the details link are added to the candidate's answers. They never overwrite an answer the candidate
--   already gave, and past applications are not touched.
-- Safe to run more than once.

alter table application_questions add column if not exists ask_at text not null default 'apply';
alter table application_questions drop constraint if exists application_questions_ask_at_check;
alter table application_questions add constraint application_questions_ask_at_check check (ask_at in ('apply', 'after_interview'));

alter table candidates add column if not exists details_submitted_at timestamptz;
alter table candidates add column if not exists details_folder uuid;

-- The apply page only gets the 'apply' questions.
create or replace function public_apply_config() returns jsonb
  language sql stable security definer set search_path = public as $$
  with bp as (select value as v from app_settings where key = 'branch_posts')
  select jsonb_build_object(
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'town', b.town, 'business_type', b.business_type,
                                   'posts', bp.v -> b.id::text) order by b.town, b.name)
                          from branches b, bp where jsonb_array_length(coalesce(bp.v -> b.id::text, '[]')) > 0), '[]'),
    'posts', coalesce((select value from app_settings where key = 'apply_posts'), '[]'),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'section', section, 'label', label, 'type', type,
                                   'options', to_jsonb(options), 'required', required, 'show_when', show_when, 'min_age', min_age)
                                   order by sort_order, created_at)
                           from application_questions where active and ask_at = 'apply'), '[]'))
$$;

-- The details link: the candidate's first name and the after-interview questions they have not answered yet.
-- {"expired": true} for an old link, null for an unknown one.
create or replace function details_by_token(p_token uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select case when c.token_expires_at < now() then jsonb_build_object('expired', true) else jsonb_build_object(
    'name', c.name,
    'submitted_at', c.details_submitted_at,
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'section', q.section, 'label', q.label, 'type', q.type,
                                   'options', to_jsonb(q.options), 'required', q.required, 'show_when', q.show_when, 'min_age', q.min_age)
                                   order by q.sort_order, q.created_at)
                           from application_questions q
                           where q.active and q.ask_at = 'after_interview' and not (coalesce(c.form_data, '{}') ? q.label)), '[]')
  ) end
  from candidates c where c.access_token = p_token
$$;
revoke all on function details_by_token(uuid) from public;
grant execute on function details_by_token(uuid) to anon, authenticated;

-- Saves the details link's answers. p = {"folder": "<uuid or empty>", "form_data": {"<label>": "<answer>"}}.
-- Returns {"status": "ok", "notify": "<hr username>"} or {"status": "forbidden" | "not_found" | "expired" | "done" | "too_big" | "bad_file"}.
create or replace function submit_details(p_token uuid, p jsonb, p_secret text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  c candidates;
  v_folder uuid := nullif(p ->> 'folder', '')::uuid;
  v_form jsonb := coalesce(p -> 'form_data', '{}');
  k text;
begin
  if not private.server_ok(p_secret) then return jsonb_build_object('status', 'forbidden'); end if;
  select * into c from candidates where access_token = p_token;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if c.token_expires_at < now() then return jsonb_build_object('status', 'expired'); end if;
  if c.details_submitted_at is not null then return jsonb_build_object('status', 'done'); end if;
  if jsonb_typeof(v_form) <> 'object' or length(v_form::text) > 20000 then return jsonb_build_object('status', 'too_big'); end if;
  if v_folder is not null and not exists (select 1 from upload_folders where folder = v_folder and used_at is null) then
    return jsonb_build_object('status', 'bad_file');
  end if;
  for k in select key from jsonb_each_text(v_form) where value like 'app-file:%' loop
    if v_folder is null or (v_form ->> k) not like 'app-file:' || v_folder::text || '/%' then
      return jsonb_build_object('status', 'bad_file');
    end if;
  end loop;
  if v_folder is not null then update upload_folders set used_at = now() where folder = v_folder; end if;

  perform set_config('app.trusted', 'on', true);
  -- earlier answers win: nothing the candidate already gave is overwritten
  update candidates set form_data = v_form || coalesce(form_data, '{}'), details_submitted_at = now(), details_folder = v_folder
  where id = c.id;
  insert into notifications (sender, recipient, message)
  values ('HR Portal', c.assigned_hr, c.name || ' (' || c.mobile || ') filled the after-interview details.');
  return jsonb_build_object('status', 'ok', 'notify', c.assigned_hr);
end $$;
revoke all on function submit_details(uuid, jsonb, text) from public;
grant execute on function submit_details(uuid, jsonb, text) to anon, authenticated;

-- HR and admins can open files uploaded through the details link too (same people as the apply files).
drop policy if exists apply_staff_read on storage.objects;
create policy apply_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'applications' and (
    exists (select 1 from candidates c
            where (c.application_folder::text = (storage.foldername(objects.name))[1]
                   or c.details_folder::text = (storage.foldername(objects.name))[1]) and can_see_candidate(c))
    or exists (select 1 from applications a join candidates c on c.id = a.candidate_id
               where a.folder::text = (storage.foldername(objects.name))[1] and can_see_candidate(c))));

-- The link must still work when a candidate is put on hold after the interview (selected ones were already covered by 0028).
create or replace function candidates_zz_link_timer() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.pipeline_status is distinct from old.pipeline_status
     and new.pipeline_status in ('Waiting for Admin Approval', 'Selected / Offer Generated', 'Expected Joining', 'Revised Joining', 'Joined') then
    new.token_expires_at := greatest(new.token_expires_at, now() + interval '60 days');
  end if;
  return new;
end $$;
revoke all on function candidates_zz_link_timer() from public, anon, authenticated;

-- The questions: age on the apply page, the rest after the interview.
insert into application_questions (section, label, type, options, required, min_age, sort_order, ask_at)
select 'About you / உங்களைப் பற்றி', 'Age / வயது', 'number', '{}', true, 18, 25, 'apply'
where not exists (select 1 from application_questions where lower(trim(label)) = lower('Age / வயது') and active);

update application_questions set ask_at = 'after_interview', updated_at = now()
where active and ask_at = 'apply' and (
     label ilike 'Gender%' or label ilike 'Date of birth%'
  or label ilike 'Fresher or experienced%' or label ilike 'Expected salary%'
  or label ilike 'Last company%' or label ilike 'Last drawn salary%'
  or label ilike 'Experience certificate%' or label ilike 'Salary proof%'
  or label ilike 'Resume or biodata%');

update application_questions set active = false, updated_at = now()
where active and label ilike 'Passport size photo%';
