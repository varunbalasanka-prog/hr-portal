-- Admins choose which posts each branch has open (app_settings 'branch_posts' = {"<branch id>": ["Cashier", ...]}).
-- The apply page lists only branches with at least one open post, and only that branch's posts.
-- Date questions can carry a minimum age; Date of birth starts at 18.

alter table application_questions add column min_age int check (min_age between 1 and 100);
update application_questions set min_age = 18 where type = 'date' and label ilike 'date of birth%' and active;

-- start with every post open at every branch, as before
insert into app_settings (key, value)
select 'branch_posts', jsonb_object_agg(b.id::text, (select value from app_settings where key = 'apply_posts'))
from branches b
on conflict (key) do nothing;

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
                           from application_questions where active), '[]'))
$$;

create or replace function submit_application(p jsonb) returns text
  language plpgsql security definer set search_path = public as $$
declare
  b branches;
  c candidates;
  v_mobile text := right(regexp_replace(coalesce(p ->> 'mobile', ''), '\D', '', 'g'), 10);
  v_name text := left(trim(coalesce(p ->> 'name', '')), 120);
  v_post text := left(trim(coalesce(p ->> 'post', '')), 120);
  v_folder uuid := nullif(p ->> 'folder', '')::uuid;
  v_form jsonb := coalesce(p -> 'form_data', '{}');
  k text;
begin
  if v_mobile !~ '^[6-9][0-9]{9}$' then return 'bad_mobile'; end if;
  if v_name = '' or v_post = '' then return 'missing'; end if;
  if length(v_form::text) > 20000 then return 'too_big'; end if;
  select * into b from branches where id = nullif(p ->> 'branch_id', '')::uuid;
  if not found then return 'bad_branch'; end if;
  -- only posts the admin has opened at this branch
  if not coalesce((select (value -> b.id::text) ? v_post from app_settings where key = 'branch_posts'), false) then return 'bad_post'; end if;
  -- uploaded files must sit in this application's own folder
  for k in select key from jsonb_each_text(v_form) where value like 'app-file:%' loop
    if v_folder is null or (v_form ->> k) not like 'app-file:' || v_folder::text || '/%' then return 'bad_file'; end if;
  end loop;

  select * into c from candidates where mobile = v_mobile;
  if found then
    update candidates set
      posts = case when v_post = any (posts) then posts else posts || v_post end,
      applied_locations = case when b.name = any (applied_locations) then applied_locations else applied_locations || b.name end
    where id = c.id;
    insert into notifications (sender, recipient, message)
    values ('HR Portal', c.assigned_hr, c.name || ' (' || v_mobile || ') applied again: ' || v_post || ' at ' || b.name || '.');
    return 'updated';
  end if;

  insert into candidates (source, name, mobile, marital_status, father_name, email, address, posts, applied_locations,
                          assigned_hr, received_at, form_data, application_folder, next_action, next_action_at)
  values ('online', v_name, v_mobile,
          nullif(left(trim(p ->> 'marital_status'), 40), ''), nullif(left(trim(p ->> 'father_name'), 120), ''),
          nullif(left(trim(p ->> 'email'), 120), ''), nullif(left(trim(p ->> 'address'), 500), ''),
          array[v_post], array[b.name], b.hr_username, now(), v_form, v_folder,
          'Follow-up start immediately', now());
  insert into notifications (sender, recipient, message)
  values ('HR Portal', b.hr_username, 'New online application: ' || v_name || ' (' || v_mobile || ') for ' || v_post || ' at ' || b.name || '.');
  return 'ok';
end $$;
revoke all on function submit_application(jsonb) from public;
grant execute on function submit_application(jsonb) to anon, authenticated;
