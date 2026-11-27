-- Resume timing per job role (varun, 27 Nov 2026): for each job role, the admin chooses whether applicants upload their
-- resume / bio data on the apply page (before the interview) or on the after-interview details link.
--
-- * job_roles.resume_at: 'apply' or 'after_interview'. Every role starts at 'after_interview', which is how the form works
--   today, so nothing changes until an admin switches a role in Admin > Job roles.
-- * application_questions.ask_at gets a third value, 'by_role': the question follows the role's setting.
--   The "Resume or biodata" question is switched to it.
-- * The details link still asks a 'by_role' question when the candidate has not answered it yet (for example someone who
--   applied before their role was switched to the apply page), so no resume goes missing.
-- * Only what the forms ask next changes. Answers and files already collected are not touched.
-- Safe to run more than once.

alter table job_roles add column if not exists resume_at text not null default 'after_interview';
alter table job_roles drop constraint if exists job_roles_resume_at_check;
alter table job_roles add constraint job_roles_resume_at_check check (resume_at in ('apply', 'after_interview'));

alter table application_questions drop constraint if exists application_questions_ask_at_check;
alter table application_questions add constraint application_questions_ask_at_check check (ask_at in ('apply', 'after_interview', 'by_role'));

-- The apply page gets the 'apply' and 'by_role' questions, and the posts whose role wants the resume on the apply page.
create or replace function public_apply_config() returns jsonb
  language sql stable security definer set search_path = public as $$
  with bp as (select value as v from app_settings where key = 'branch_posts')
  select jsonb_build_object(
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'town', b.town, 'business_type', b.business_type,
                                   'posts', bp.v -> b.id::text) order by b.town, b.name)
                          from branches b, bp where jsonb_array_length(coalesce(bp.v -> b.id::text, '[]')) > 0), '[]'),
    'posts', coalesce((select value from app_settings where key = 'apply_posts'), '[]'),
    'resume_posts', coalesce((select jsonb_agg(name order by name) from job_roles where active and resume_at = 'apply'), '[]'),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'section', section, 'label', label, 'type', type,
                                   'options', to_jsonb(options), 'required', required, 'show_when', show_when, 'min_age', min_age,
                                   'ask_at', ask_at)
                                   order by sort_order, created_at)
                           from application_questions where active and ask_at in ('apply', 'by_role')), '[]'))
$$;

-- The details link: the after-interview and 'by_role' questions the candidate has not answered yet.
create or replace function details_by_token(p_token uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select case when c.token_expires_at < now() then jsonb_build_object('expired', true) else jsonb_build_object(
    'name', c.name,
    'submitted_at', c.details_submitted_at,
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'section', q.section, 'label', q.label, 'type', q.type,
                                   'options', to_jsonb(q.options), 'required', q.required, 'show_when', q.show_when, 'min_age', q.min_age,
                                   'ask_at', q.ask_at)
                                   order by q.sort_order, q.created_at)
                           from application_questions q
                           where q.active and q.ask_at in ('after_interview', 'by_role') and not (coalesce(c.form_data, '{}') ? q.label)), '[]')
  ) end
  from candidates c where c.access_token = p_token
$$;
revoke all on function details_by_token(uuid) from public;
grant execute on function details_by_token(uuid) to anon, authenticated;

-- The resume question follows each role's setting from now on.
update application_questions set ask_at = 'by_role', updated_at = now()
where active and ask_at <> 'by_role' and label ilike 'Resume or biodata%';
