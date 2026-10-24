-- The /apply page's extra questions and post list are edited by admins in the portal.
-- Each application stores its answers under the question's label as it was when the applicant
-- submitted, so editing, reordering or deleting a question never changes past applications.
-- Delete is a soft delete (active = false) so a question can be restored.

create table application_questions (
  id uuid primary key default gen_random_uuid(),
  section text not null default 'More details' check (length(section) between 1 and 80),
  label text not null check (length(trim(label)) between 1 and 300),
  type text not null check (type in ('text', 'long_text', 'number', 'date', 'choice', 'file')),
  options text[] not null default '{}',
  required boolean not null default false,
  sort_order int not null default 0,
  active boolean not null default true,
  -- {"question_id": "<uuid>", "equals": "<option>"}: only asked when that choice question has that answer
  show_when jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- two live questions with the same label would overwrite each other's answers
create unique index application_questions_live_label on application_questions (lower(trim(label))) where active;

create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table application_questions enable row level security;
alter table app_settings enable row level security;
create policy questions_read on application_questions for select to authenticated using (true);
create policy questions_admin on application_questions for all to authenticated using (is_admin()) with check (is_admin());
create policy settings_read on app_settings for select to authenticated using (true);
create policy settings_admin on app_settings for all to authenticated using (is_admin()) with check (is_admin());

-- What the public /apply page needs, in one call: branches, posts and the live questions in order.
create or replace function public_apply_config() returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'town', town, 'business_type', business_type) order by town, name) from branches), '[]'),
    'posts', coalesce((select value from app_settings where key = 'apply_posts'), '[]'),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'section', section, 'label', label, 'type', type,
                                   'options', to_jsonb(options), 'required', required, 'show_when', show_when) order by sort_order, created_at)
                           from application_questions where active), '[]'))
$$;
revoke all on function public_apply_config() from public;
grant execute on function public_apply_config() to anon, authenticated;

-- Starting questions: the same ones the apply page had, with the old Google Form's labels.
insert into app_settings (key, value) values ('apply_posts', '["Executive Sales", "Retail Sales Officer", "Jewellery Consultant",
  "Floor Supervisor", "Store Manager", "Cashier", "Executive Accounts", "Data Entry Operator", "Customer Care Executive",
  "Customer Care Manager", "Receptionist", "HR Executive", "Digital Marketing", "Service Advisor", "Manager Service",
  "Manager Spares", "Technician", "Assistant Technician", "Incharge PDI", "Electrician", "Helper", "House Keeping"]');

with q (n, section, label, type, options, required) as (values
  (1, 'About you', 'Gender', 'choice', array['Male', 'Female', 'Other'], true),
  (2, 'About you', 'Date Of Birth', 'date', '{}'::text[], true),
  (3, 'About you', 'Educational Qualification', 'text', '{}', true),
  (4, 'Experience', 'Are you a Fresher or Experienced? / நீங்கள் Fresher-ஆ அல்லது முன் அனுபவம் உள்ளவரா?', 'choice', array['Fresher', 'Experienced'], true),
  (5, 'Experience', 'Expected Salary', 'text', '{}', false),
  (6, 'Experience', 'Name of the Last Worked Company & Total Experience', 'text', '{}', true),
  (7, 'Experience', 'Last Drawn Salary', 'text', '{}', true),
  (8, 'Experience', 'Experience Certificate', 'file', '{}', false),
  (9, 'Experience', 'Salary Proof', 'file', '{}', false),
  (10, 'Documents', 'Passport Size Photo', 'file', '{}', true),
  (11, 'Documents', 'Resume or Biodata', 'file', '{}', false)
)
insert into application_questions (section, label, type, options, required, sort_order)
select section, label, type, options, required, n * 10 from q;

update application_questions set show_when = jsonb_build_object('question_id',
    (select id from application_questions where label like 'Are you a Fresher or Experienced?%'), 'equals', 'Experienced')
where label in ('Name of the Last Worked Company & Total Experience', 'Last Drawn Salary', 'Experience Certificate', 'Salary Proof');

-- the apply page now reads branches through public_apply_config()
revoke execute on function public_branches() from anon, authenticated;
