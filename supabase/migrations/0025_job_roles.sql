-- The company role list: which roles exist at each firm (division), from the staff list of 29 Oct 2026.
-- Needs 0024_job_listings.sql (job_roles, job_openings) first.
-- 1. Renames three old apply-page posts to the names the company uses, without resetting open job listings.
-- 2. Adds every role from the staff list (Cashier Sales and Customer Care Executive - Reminder are merged into
--    Cashier and Customer Care Executive). A role open at a store today is added to its firm, so nothing closes.
-- 3. division_roles: the roles each firm has. All its stores share the list. Only admin changes it.
-- 4. A store can only open (Store posts) roles its firm has. The apply-page post list (apply_posts) now follows
--    the live roles automatically.
-- Past candidates, manpower requests and staff records keep the post names they were saved with.
-- Safe to run once; re-running is harmless.

-- Helpers ------------------------------------------------------------------------------------------------------
-- Drops posts a store's firm doesn't have (or that were deleted) from Store posts. Leaves the row alone if nothing changes,
-- so the careers page's "posted" date doesn't move.
create or replace function _prune_branch_posts() returns void
  language plpgsql security definer set search_path = public as $$
declare v_old jsonb; v_new jsonb;
begin
  select value into v_old from app_settings where key = 'branch_posts';
  if v_old is null then return; end if;
  select coalesce(jsonb_object_agg(b.key, (
           select coalesce(jsonb_agg(p.post order by p.n), '[]')
             from jsonb_array_elements_text(case jsonb_typeof(b.value) when 'array' then b.value else '[]' end) with ordinality p(post, n)
            where exists (select 1 from branches br
                            join division_roles dr on dr.division = br.division
                            join job_roles r on r.id = dr.role_id and r.active
                           where br.id::text = b.key and r.name = p.post))), '{}')
    into v_new from jsonb_each(v_old) b;
  if v_new is distinct from v_old then
    update app_settings set value = v_new, updated_at = now() where key = 'branch_posts';
  end if;
end $$;
revoke all on function _prune_branch_posts() from public, anon, authenticated;

-- Renames a role everywhere it is live, in the order that keeps open job listings (and their posting date) intact:
-- open job_openings first, then Store posts, then the role itself.
create or replace function _rename_job_role(p_old text, p_new text) returns text
  language plpgsql security definer set search_path = public as $$
declare v_new text := regexp_replace(trim(coalesce(p_new, '')), '\s+', ' ', 'g');
begin
  if p_old is null or not exists (select 1 from job_roles where name = p_old) then return 'not_found'; end if;
  if v_new = '' or length(v_new) > 120 then return 'bad_name'; end if;
  if v_new = p_old then return 'ok'; end if;
  if exists (select 1 from job_roles where lower(name) = lower(v_new) and name <> p_old) then return 'exists'; end if;
  update job_openings set post = v_new where post = p_old and closed_at is null;
  update app_settings s set value = (
      select coalesce(jsonb_object_agg(b.key, (
               select coalesce(jsonb_agg(case when p.post = p_old then v_new else p.post end order by p.n), '[]')
                 from jsonb_array_elements_text(case jsonb_typeof(b.value) when 'array' then b.value else '[]' end) with ordinality p(post, n))), '{}')
        from jsonb_each(s.value) b), updated_at = now()
   where s.key = 'branch_posts' and exists (select 1 from jsonb_each(s.value) b where jsonb_typeof(b.value) = 'array' and b.value ? p_old);
  update job_roles set name = v_new, updated_at = now() where name = p_old;
  return 'ok';
end $$;
revoke all on function _rename_job_role(text, text) from public, anon, authenticated;

-- 3. Roles per firm ----------------------------------------------------------------------------------------------
create table if not exists division_roles (
  division text not null,                                     -- branches.division, e.g. "Caratlane"
  role_id  uuid not null references job_roles (id) on delete cascade,
  primary key (division, role_id)
);
alter table division_roles enable row level security;
drop policy if exists division_roles_read on division_roles;
create policy division_roles_read on division_roles for select to authenticated using (true);
-- Admin changes these only through set_division_roles() below.

-- apply_posts (the apply page's and walk-in form's full post list) = the live roles.
create or replace function job_roles_sync_posts() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  select coalesce(jsonb_agg(name order by sort, name), '[]') into v from job_roles where active;
  update app_settings set value = v, updated_at = now() where key = 'apply_posts' and value is distinct from v;
  return null;
end $$;
revoke all on function job_roles_sync_posts() from public, anon, authenticated;
drop trigger if exists job_roles_sync_posts on job_roles;
create trigger job_roles_sync_posts after insert or update or delete on job_roles
  for each statement execute function job_roles_sync_posts();
drop trigger if exists audit on job_roles;
create trigger audit after insert or update or delete on job_roles for each row execute function audit_row();

-- A firm renamed in Staff > Firms keeps its role list.
create or replace function branches_keep_division_roles() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.division is distinct from old.division and new.division is not null
     and not exists (select 1 from division_roles where division = new.division) then
    insert into division_roles (division, role_id) select new.division, role_id from division_roles where division = old.division
    on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function branches_keep_division_roles() from public, anon, authenticated;
drop trigger if exists branches_keep_division_roles on branches;
create trigger branches_keep_division_roles after update of division on branches
  for each row execute function branches_keep_division_roles();

-- Admin actions -------------------------------------------------------------------------------------------------
create or replace function rename_job_role(p_id uuid, p_name text) returns text
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can rename roles'; end if;
  return _rename_job_role((select name from job_roles where id = p_id), p_name);
end $$;

-- Delete hides the role everywhere new data is entered and closes it at every store. Restore brings it back.
create or replace function set_job_role_active(p_id uuid, p_active boolean) returns text
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can delete roles'; end if;
  update job_roles set active = p_active, updated_at = now() where id = p_id;
  if not found then return 'not_found'; end if;
  perform _prune_branch_posts();
  return 'ok';
end $$;

-- Sets the full role list of one firm. Roles taken off are also closed at that firm's stores.
create or replace function set_division_roles(p_division text, p_roles uuid[]) returns text
  language plpgsql security definer set search_path = public as $$
declare v_before jsonb; v_after jsonb;
begin
  if not is_admin() then raise exception 'Only an admin can change a firm''s roles'; end if;
  if not exists (select 1 from branches where division = p_division) then return 'not_found'; end if;
  select coalesce(jsonb_agg(r.name order by r.name), '[]') into v_before
    from division_roles d join job_roles r on r.id = d.role_id where d.division = p_division;
  delete from division_roles where division = p_division and not (role_id = any(coalesce(p_roles, '{}')));
  insert into division_roles (division, role_id)
  select p_division, r.id from job_roles r where r.id = any(coalesce(p_roles, '{}')) on conflict do nothing;
  select coalesce(jsonb_agg(r.name order by r.name), '[]') into v_after
    from division_roles d join job_roles r on r.id = d.role_id where d.division = p_division;
  if v_after is distinct from v_before then
    perform log_change('firm roles update', p_division, jsonb_build_object('roles', jsonb_build_object('from', v_before, 'to', v_after)));
  end if;
  perform _prune_branch_posts();
  return 'ok';
end $$;
revoke all on function rename_job_role(uuid, text), set_job_role_active(uuid, boolean), set_division_roles(text, uuid[]) from public, anon;
grant execute on function rename_job_role(uuid, text), set_job_role_active(uuid, boolean), set_division_roles(text, uuid[]) to authenticated;

-- 1. Old apply-page names -> company names ------------------------------------------------------------------------
select _rename_job_role('Technician', 'Technical Executive') where not exists (select 1 from job_roles where name = 'Technical Executive');
select _rename_job_role('Assistant Technician', 'Asst. Technical Executive') where not exists (select 1 from job_roles where name = 'Asst. Technical Executive');
select _rename_job_role('Digital Marketing', 'Digital Marketing Executive') where not exists (select 1 from job_roles where name = 'Digital Marketing Executive');

-- 2. + 3. Roles from the staff list, and which firm has them -----------------------------------------------------
insert into job_roles (name) values
  ('Asst. Technical Executive'),
  ('BOS'),
  ('Bar Code Executive'),
  ('Bill & Cash'),
  ('Building Supervisor'),
  ('Call Center Executive'),
  ('Cashier'),
  ('Customer Care Executive'),
  ('Customer Care Manager'),
  ('Data Entry Operator'),
  ('Day Security'),
  ('Digital Marketing Executive'),
  ('Driver'),
  ('Electrician'),
  ('Executive Accounts'),
  ('Executive Registration'),
  ('Executive Sales'),
  ('Executive Spares'),
  ('Floor Supervisor'),
  ('HR Executive'),
  ('House Keeping'),
  ('Incharge Accounts'),
  ('Incharge PDI'),
  ('Incharge Registration'),
  ('Incharge Spares'),
  ('Jewellery Consultant'),
  ('Karikar'),
  ('Manager Network'),
  ('Manager Sales'),
  ('Manager Service'),
  ('Manager Spares'),
  ('Night Security'),
  ('Office Staff'),
  ('Office Supervisor'),
  ('Optometrist'),
  ('Order Executive'),
  ('PDI Supervisor'),
  ('Purchase Executive'),
  ('Retail Sales Officer'),
  ('Sales Rep'),
  ('Security'),
  ('Service Advisor'),
  ('Store Manager'),
  ('Technical Executive'),
  ('Technician PDI'),
  ('Trainer')
on conflict (name) do nothing;

insert into division_roles (division, role_id)
select v.division, r.id from (values
  ('Akshaya Velli', 'Bar Code Executive'),
  ('Akshaya Velli', 'Bill & Cash'),
  ('Akshaya Velli', 'Call Center Executive'),
  ('Akshaya Velli', 'Cashier'),
  ('Akshaya Velli', 'Digital Marketing Executive'),
  ('Akshaya Velli', 'Driver'),
  ('Akshaya Velli', 'Executive Accounts'),
  ('Akshaya Velli', 'Executive Sales'),
  ('Akshaya Velli', 'HR Executive'),
  ('Akshaya Velli', 'House Keeping'),
  ('Akshaya Velli', 'Manager Sales'),
  ('Akshaya Velli', 'Order Executive'),
  ('Akshaya Velli', 'Purchase Executive'),
  ('Akshaya Velli', 'Retail Sales Officer'),
  ('Akshaya Velli', 'Sales Rep'),
  ('Akshaya Velli', 'Store Manager'),
  ('Akshaya Velli', 'Trainer'),
  ('Balasanka Cycle', 'Executive Sales'),
  ('Balasanka Cycle', 'PDI Supervisor'),
  ('Balasanka Cycle', 'Technical Executive'),
  ('Balasanka TVS', 'Asst. Technical Executive'),
  ('Balasanka TVS', 'Cashier'),
  ('Balasanka TVS', 'Customer Care Executive'),
  ('Balasanka TVS', 'Customer Care Manager'),
  ('Balasanka TVS', 'Data Entry Operator'),
  ('Balasanka TVS', 'Driver'),
  ('Balasanka TVS', 'Executive Accounts'),
  ('Balasanka TVS', 'Executive Registration'),
  ('Balasanka TVS', 'Executive Sales'),
  ('Balasanka TVS', 'Executive Spares'),
  ('Balasanka TVS', 'Floor Supervisor'),
  ('Balasanka TVS', 'House Keeping'),
  ('Balasanka TVS', 'Incharge PDI'),
  ('Balasanka TVS', 'Manager Network'),
  ('Balasanka TVS', 'Manager Sales'),
  ('Balasanka TVS', 'Manager Service'),
  ('Balasanka TVS', 'Manager Spares'),
  ('Balasanka TVS', 'PDI Supervisor'),
  ('Balasanka TVS', 'Service Advisor'),
  ('Balasanka TVS', 'Technical Executive'),
  ('Balasanka TVS', 'Technician PDI'),
  ('Balasanka Zora', 'Cashier'),
  ('Balasanka Zora', 'Executive Sales'),
  ('Balasanka Zora', 'House Keeping'),
  ('Balasanka Zora', 'Manager Sales'),
  ('Balasanka Zora', 'Retail Sales Officer'),
  ('Caratlane', 'House Keeping'),
  ('Caratlane', 'Jewellery Consultant'),
  ('Caratlane', 'Store Manager'),
  ('Eye plus', 'Optometrist'),
  ('Eye plus', 'Sales Rep'),
  ('Eye plus', 'Technical Executive'),
  ('Fast track', 'Executive Sales'),
  ('Fast track', 'Store Manager'),
  ('Mia', 'Executive Sales'),
  ('Mia', 'Manager Sales'),
  ('Mia', 'Retail Sales Officer'),
  ('Mukesh Honda', 'Asst. Technical Executive'),
  ('Mukesh Honda', 'Cashier'),
  ('Mukesh Honda', 'Customer Care Executive'),
  ('Mukesh Honda', 'Data Entry Operator'),
  ('Mukesh Honda', 'Driver'),
  ('Mukesh Honda', 'Executive Accounts'),
  ('Mukesh Honda', 'Executive Registration'),
  ('Mukesh Honda', 'Executive Sales'),
  ('Mukesh Honda', 'Executive Spares'),
  ('Mukesh Honda', 'House Keeping'),
  ('Mukesh Honda', 'Incharge Accounts'),
  ('Mukesh Honda', 'Incharge PDI'),
  ('Mukesh Honda', 'Incharge Spares'),
  ('Mukesh Honda', 'Manager Sales'),
  ('Mukesh Honda', 'Manager Service'),
  ('Mukesh Honda', 'Manager Spares'),
  ('Mukesh Honda', 'PDI Supervisor'),
  ('Mukesh Honda', 'Service Advisor'),
  ('Mukesh Honda', 'Technical Executive'),
  ('Mukesh Honda', 'Technician PDI'),
  ('SDM', 'Building Supervisor'),
  ('SDM', 'Driver'),
  ('SDM', 'Electrician'),
  ('SDM', 'Executive Accounts'),
  ('SDM', 'Office Staff'),
  ('SDM', 'Office Supervisor'),
  ('Shri Murugesan TVS', 'Asst. Technical Executive'),
  ('Shri Murugesan TVS', 'Cashier'),
  ('Shri Murugesan TVS', 'Customer Care Executive'),
  ('Shri Murugesan TVS', 'Data Entry Operator'),
  ('Shri Murugesan TVS', 'Day Security'),
  ('Shri Murugesan TVS', 'Executive Accounts'),
  ('Shri Murugesan TVS', 'Executive Registration'),
  ('Shri Murugesan TVS', 'Executive Sales'),
  ('Shri Murugesan TVS', 'Executive Spares'),
  ('Shri Murugesan TVS', 'Floor Supervisor'),
  ('Shri Murugesan TVS', 'HR Executive'),
  ('Shri Murugesan TVS', 'House Keeping'),
  ('Shri Murugesan TVS', 'Incharge Accounts'),
  ('Shri Murugesan TVS', 'Incharge PDI'),
  ('Shri Murugesan TVS', 'Incharge Registration'),
  ('Shri Murugesan TVS', 'Incharge Spares'),
  ('Shri Murugesan TVS', 'Manager Network'),
  ('Shri Murugesan TVS', 'Manager Sales'),
  ('Shri Murugesan TVS', 'Manager Service'),
  ('Shri Murugesan TVS', 'Night Security'),
  ('Shri Murugesan TVS', 'PDI Supervisor'),
  ('Shri Murugesan TVS', 'Service Advisor'),
  ('Shri Murugesan TVS', 'Technical Executive'),
  ('Shri Murugesan TVS', 'Technician PDI'),
  ('Tanishq', 'BOS'),
  ('Tanishq', 'Cashier'),
  ('Tanishq', 'Customer Care Executive'),
  ('Tanishq', 'Executive Accounts'),
  ('Tanishq', 'House Keeping'),
  ('Tanishq', 'Karikar'),
  ('Tanishq', 'Manager Sales'),
  ('Tanishq', 'Retail Sales Officer'),
  ('Tanishq', 'Security'),
  ('Titan', 'House Keeping'),
  ('Titan', 'Sales Rep'),
  ('Titan', 'Store Manager'),
  ('Titan', 'Technical Executive'),
  ('Yasotha Motors', 'Asst. Technical Executive'),
  ('Yasotha Motors', 'Cashier'),
  ('Yasotha Motors', 'Customer Care Executive'),
  ('Yasotha Motors', 'Data Entry Operator'),
  ('Yasotha Motors', 'Day Security'),
  ('Yasotha Motors', 'Executive Accounts'),
  ('Yasotha Motors', 'Executive Sales'),
  ('Yasotha Motors', 'Executive Spares'),
  ('Yasotha Motors', 'House Keeping'),
  ('Yasotha Motors', 'Incharge PDI'),
  ('Yasotha Motors', 'Incharge Registration'),
  ('Yasotha Motors', 'Incharge Spares'),
  ('Yasotha Motors', 'Manager Network'),
  ('Yasotha Motors', 'Manager Sales'),
  ('Yasotha Motors', 'Manager Service'),
  ('Yasotha Motors', 'Night Security'),
  ('Yasotha Motors', 'Service Advisor'),
  ('Yasotha Motors', 'Technical Executive'),
  ('Yasotha Motors', 'Technician PDI')
) v(division, role) join job_roles r on r.name = v.role
on conflict do nothing;

-- Posts open at a store right now stay open: their role is added to that store's firm (admin can take it off later).
insert into division_roles (division, role_id)
select distinct br.division, r.id
  from app_settings s
 cross join lateral jsonb_each(s.value) b
 cross join lateral jsonb_array_elements_text(case jsonb_typeof(b.value) when 'array' then b.value else '[]' end) p(post)
  join branches br on br.id::text = b.key and br.division is not null
  join job_roles r on r.name = p.post and r.active
 where s.key = 'branch_posts'
on conflict do nothing;

-- 4. Tidy up: the full post list follows the live roles, and stores keep only their firm's roles open.
update app_settings set value = (select coalesce(jsonb_agg(name order by sort, name), '[]') from job_roles where active), updated_at = now()
 where key = 'apply_posts' and value is distinct from (select coalesce(jsonb_agg(name order by sort, name), '[]') from job_roles where active);
select _prune_branch_posts();
