-- Online applications come in through the portal's own /apply page instead of a Google Form.
-- Applicants use the public key: they can list branches, upload into a fresh folder in a private
-- bucket, and submit through submit_application(). They can't read anything back.

alter table candidates add column application_folder uuid unique;

insert into storage.buckets (id, name, public, file_size_limit)
values ('applications', 'applications', false, 8388608)
on conflict (id) do nothing;

create policy apply_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'applications'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
create policy apply_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'applications' and exists (
    select 1 from candidates c
    where c.application_folder::text = (storage.foldername(name))[1] and can_see_candidate(c)));

create or replace function public_branches() returns table (id uuid, name text, town text, business_type text)
  language sql stable security definer set search_path = public as $$
  select id, name, town, business_type from branches order by town, name
$$;
revoke all on function public_branches() from public;
grant execute on function public_branches() to anon, authenticated;

-- Returns 'ok' (new candidate), 'updated' (known mobile: post/branch added), or an error code.
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
