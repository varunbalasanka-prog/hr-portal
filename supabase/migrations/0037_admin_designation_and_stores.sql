-- 0037: admins can change anyone's designation, and add or delete a store.
--
-- Designation: after a person's first month, a designation change normally goes through an appraisal (0020). An admin
-- can now change it directly. A real change (role change, promotion, demotion) closes the current register line the
-- day before the start date and opens a new one, so history is kept. A "correction" fixes the current line in place.
-- People not yet joined (selected, offer, onboarding) just get the new designation on their candidate row.
--
-- Stores: "delete" only works for a store nothing points to (no candidates, applications, staff records, logins,
-- manpower or walk-in requests). varun chose this on 2026-11-10: move or remove those first, history is never lost.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- Designation
-- ---------------------------------------------------------------------------
create or replace function change_designation(p_employment uuid, p_designation text, p_kind text, p_from date, p_reason text)
  returns text language plpgsql security definer set search_path = public as $$
declare
  v_desig text := nullif(trim(p_designation), '');
  v_kind text := coalesce(nullif(trim(p_kind), ''), 'role change');
  v_from date := coalesce(p_from, ist_today());
  who text := actor_name();
  pos employee_positions; em employments; e employees;
begin
  if not is_admin() then raise exception 'Only an admin can change a designation'; end if;
  if v_desig is null then raise exception 'Pick a designation'; end if;
  if v_kind not in ('role change', 'promotion', 'demotion', 'correction') then raise exception 'Unknown kind of change'; end if;

  select * into em from employments where id = p_employment;
  if em.id is null then raise exception 'Staff record not found'; end if;
  -- The open line, or the last one for someone who has left (only a correction makes sense then).
  select * into pos from employee_positions where employment_id = em.id
   order by (to_date is null) desc, from_date desc, id desc limit 1 for update;
  if pos.id is null then raise exception 'This person has no store or role line yet'; end if;
  if pos.designation is not distinct from v_desig then raise exception 'They already have this designation'; end if;
  if pos.to_date is not null and v_kind <> 'correction' then
    raise exception 'This person has left. Only a correction of their last designation is possible.';
  end if;

  if v_kind = 'correction' or v_from <= pos.from_date then
    update employee_positions
       set designation = v_desig,
           reason = concat_ws(' · ', nullif(reason, ''), 'Designation corrected by ' || who || coalesce(': ' || nullif(trim(p_reason), ''), ''))
     where id = pos.id;
    v_kind := 'correction';
  else
    if v_from > ist_today() + 60 then raise exception 'The start date can be at most 60 days ahead'; end if;
    update employee_positions set to_date = v_from - 1 where id = pos.id;
    insert into employee_positions (employment_id, branch_id, designation, basic, allowances, from_date, change_type, reason, entered_by, approved_by)
    values (em.id, pos.branch_id, v_desig, pos.basic, pos.allowances, v_from, v_kind, nullif(trim(p_reason), ''), who, who);
  end if;

  -- Hired through the portal: the candidate row is what letters and lists read. Keep it in step for the current stint.
  select * into e from employees where id = em.employee_id;
  if e.candidate_id is not null and (pos.to_date is null or v_kind = 'correction') then
    perform set_config('app.appraisal', 'on', true);
    perform set_config('app.trusted', 'on', true);
    update candidates set designation = v_desig where id = e.candidate_id and actual_joining_date = em.joined_on;
    perform set_config('app.appraisal', 'off', true);
    perform set_config('app.trusted', 'off', true);
  end if;

  perform log_change('change designation', em.id::text,
    jsonb_build_object('name', e.name, 'from', pos.designation, 'to', v_desig, 'kind', v_kind, 'start', v_from, 'reason', nullif(trim(p_reason), '')));
  return v_kind;
end $$;
revoke all on function change_designation(uuid, text, text, date, text) from public, anon;
grant execute on function change_designation(uuid, text, text, date, text) to authenticated;

-- From the candidate panel. Working staff go through the register (above); everyone else just gets the new value.
create or replace function set_candidate_designation(p_candidate uuid, p_designation text, p_kind text, p_from date, p_reason text)
  returns text language plpgsql security definer set search_path = public as $$
declare
  c candidates; v_desig text := nullif(trim(p_designation), ''); v_em uuid;
begin
  if not is_admin() then raise exception 'Only an admin can change a designation'; end if;
  if v_desig is null then raise exception 'Pick a designation'; end if;
  select * into c from candidates where id = p_candidate for update;
  if c.id is null then raise exception 'Candidate not found'; end if;

  select em.id into v_em from employees e join employments em on em.employee_id = e.id
   where e.candidate_id = c.id and em.joined_on = c.actual_joining_date
   order by em.created_at desc limit 1;
  if v_em is not null and (c.pipeline_status = 'Joined' or c.pipeline_status like 'Left%') then
    return change_designation(v_em, v_desig, case when c.pipeline_status like 'Left%' then 'correction' else p_kind end, p_from, p_reason);
  end if;

  if c.designation is not distinct from v_desig then raise exception 'They already have this designation'; end if;
  perform set_config('app.trusted', 'on', true);
  update candidates set designation = v_desig where id = c.id;
  perform set_config('app.trusted', 'off', true);
  perform log_change('change designation', c.id::text, jsonb_build_object('name', c.name, 'from', c.designation, 'to', v_desig));
  return 'updated';
end $$;
revoke all on function set_candidate_designation(uuid, text, text, date, text) from public, anon;
grant execute on function set_candidate_designation(uuid, text, text, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Stores
-- ---------------------------------------------------------------------------
-- What points at each store, so the Stores tab can say whether Delete is possible.
create or replace function store_usage() returns table (branch_id uuid, candidates int, staff int, logins int, requests int)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  return query
  select b.id,
    ((select count(*) from candidates x where x.branch_id = b.id)
      + (select count(*) from candidates x where x.branch_id is null and b.name = any(x.applied_locations))
      + (select count(*) from applications x where x.branch_id = b.id))::int,
    ((select count(distinct p.employment_id) from employee_positions p where p.branch_id = b.id)
      + (select count(*) from staff_loans l where l.from_branch_id = b.id or l.to_branch_id = b.id))::int,
    (select count(*) from profiles x where x.branch_id = b.id)::int,
    ((select count(*) from manpower_requests x where x.branch_id = b.id)
      + (select count(*) from walkin_requests x where x.branch_id = b.id))::int
  from branches b;
end $$;
revoke all on function store_usage() from public, anon;
grant execute on function store_usage() to authenticated;

-- Delete a store for good. Refuses if anything points at it.
create or replace function delete_store(p_branch uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare b branches; u record;
begin
  if not is_admin() then raise exception 'Only an admin can delete a store'; end if;
  select * into b from branches where id = p_branch for update;
  if b.id is null then raise exception 'Store not found'; end if;
  select * into u from store_usage() s where s.branch_id = b.id;
  if u.candidates + u.staff + u.logins + u.requests > 0 then
    raise exception '% has % candidate(s), % staff record(s), % login(s) and % request(s). Move or remove these first.',
      b.name, u.candidates, u.staff, u.logins, u.requests;
  end if;
  update app_settings set value = value - b.id::text where key = 'branch_posts' and value ? b.id::text;
  delete from branches where id = b.id;
  perform log_change('delete store', b.id::text, jsonb_build_object('name', b.name, 'town', b.town));
end $$;
revoke all on function delete_store(uuid) from public, anon;
grant execute on function delete_store(uuid) to authenticated;
