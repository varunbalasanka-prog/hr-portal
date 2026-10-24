-- Super admin rules (varun's choice, 2026-10-24): a super admin can do everything an admin can, and only a super admin
-- can create, remove, change or reset admin and super admin logins, or read the change history.

create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'superadmin') from profiles where id = auth.uid()), false)
$$;

create or replace function is_super_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'superadmin' from profiles where id = auth.uid()), false)
$$;
revoke execute on function is_super_admin() from public, anon;
grant execute on function is_super_admin() to authenticated;

create or replace function can_see_candidate(c candidates) returns boolean
  language sql stable security definer set search_path = public as $$
  select case
    when p.role in ('admin', 'superadmin') then true
    when p.role = 'hr' then c.assigned_hr = p.username
    when p.role = 'branch' then (c.branch_id = p.branch_id
        or exists (select 1 from branches b where b.id = p.branch_id and b.name = any (c.applied_locations)))
      and (c.source = 'walkin' or c.pipeline_status <> 'Follow-up Not Started')
    else false end
  from profiles p where p.id = auth.uid()
$$;

-- Admins manage staff (hr, branch) only; admin and super admin rows are the super admin's.
-- profiles_admin (from 0001) now means the super admin
alter policy profiles_admin on profiles using (is_super_admin()) with check (is_super_admin());
create policy profiles_admin_staff on profiles for all to authenticated
  using (is_admin() and role in ('hr', 'branch')) with check (is_admin() and role in ('hr', 'branch'));

-- ---------------------------------------------------------------------------
-- Change history: written by triggers and account functions, read by the super admin only.
-- ---------------------------------------------------------------------------
create table audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  target text,
  detail jsonb
);
create index audit_log_at on audit_log (at desc);
alter table audit_log enable row level security;
create policy audit_super_read on audit_log for select to authenticated using (is_super_admin());

create or replace function log_change(p_action text, p_target text, p_detail jsonb) returns void
  language sql security definer set search_path = public as $$
  insert into audit_log (actor, action, target, detail)
  values (coalesce((select username from profiles where id = auth.uid()), 'system'), p_action, p_target, p_detail)
$$;
revoke all on function log_change(text, text, jsonb) from public, anon, authenticated;

-- Row changes: which columns changed, from what to what.
create or replace function audit_row() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  diff jsonb;
  target text;
begin
  target := coalesce(n, o) ->> (case tg_table_name when 'app_settings' then 'key' when 'profiles' then 'username'
                                                 when 'application_questions' then 'label' else 'name' end);
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_object('from', o -> k, 'to', n -> k)) into diff
    from jsonb_object_keys(n) k where k not in ('updated_at') and (o -> k) is distinct from (n -> k);
    if diff is null then return new; end if;
  else
    diff := coalesce(n, o) - 'updated_at' - 'created_at';
  end if;
  perform log_change(tg_table_name || ' ' || lower(tg_op), target, diff);
  return coalesce(new, old);
end $$;
revoke all on function audit_row() from public, anon, authenticated;

create trigger audit after insert or update or delete on application_questions for each row execute function audit_row();
create trigger audit after insert or update or delete on app_settings for each row execute function audit_row();
create trigger audit after insert or update or delete on branches for each row execute function audit_row();
create trigger audit after insert or update or delete on profiles for each row execute function audit_row();
create trigger audit after delete on candidates for each row execute function audit_row();

-- ---------------------------------------------------------------------------
-- Account functions used by the Admin page
-- ---------------------------------------------------------------------------
create or replace function admin_set_password(p_user uuid, p_password text) returns void
  language plpgsql security definer set search_path = public, extensions as $$
declare t profiles;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select * into t from profiles where id = p_user;
  if not found then raise exception 'user not found'; end if;
  if t.role in ('admin', 'superadmin') and not is_super_admin() and p_user <> auth.uid() then
    raise exception 'only the super admin can reset an admin password';
  end if;
  if length(p_password) < 8 then raise exception 'password must be at least 8 characters'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
  where id = p_user;
  perform log_change('password reset', t.username, null);
end $$;
revoke all on function admin_set_password(uuid, text) from public, anon;
grant execute on function admin_set_password(uuid, text) to authenticated;

create or replace function admin_create_user(p_username text, p_full_name text, p_role user_role, p_branch uuid, p_email text, p_password text)
  returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if p_role in ('admin', 'superadmin') and not is_super_admin() then raise exception 'only the super admin can create admins'; end if;
  if p_role = 'branch' and p_branch is null then raise exception 'a store login needs a store'; end if;
  if length(p_password) < 8 then raise exception 'password must be at least 8 characters'; end if;
  if exists (select 1 from profiles where lower(username) = lower(trim(p_username))) or exists (select 1 from auth.users where email = lower(p_email)) then
    raise exception 'that username is already taken';
  end if;
  uid := create_staff_user(lower(trim(p_username)), trim(p_full_name), p_role, case when p_role = 'branch' then p_branch end, p_email, p_password);
  return uid;
end $$;
revoke all on function admin_create_user(text, text, user_role, uuid, text, text) from public, anon;
grant execute on function admin_create_user(text, text, user_role, uuid, text, text) to authenticated;

create or replace function admin_delete_user(p_user uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare t profiles;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if p_user = auth.uid() then raise exception 'you cannot remove your own login'; end if;
  select * into t from profiles where id = p_user;
  if not found then raise exception 'user not found'; end if;
  if t.role in ('admin', 'superadmin') and not is_super_admin() then raise exception 'only the super admin can remove an admin'; end if;
  if t.role = 'superadmin' and (select count(*) from profiles where role = 'superadmin') = 1 then raise exception 'keep at least one super admin'; end if;
  delete from auth.users where id = p_user;  -- the profile row goes with it (logged by its trigger)
end $$;
revoke all on function admin_delete_user(uuid) from public, anon;
grant execute on function admin_delete_user(uuid) to authenticated;

-- varun's own login is the super admin
update profiles set role = 'superadmin' where username = 'varun';
