-- Which HR looks after each store (varun, 29 Oct 2026).
--  * Admins pick the HR for each store on the Admin page. One HR can look after many stores; a store has one HR.
--  * The store's HR gets its new applications, walk-ins, manpower requests, staff records and appraisals
--    (all of these already follow branches.hr_username).
--  * Candidates each keep their own HR (candidates.assigned_hr), so changing a store's HR also moves that store's
--    candidates: all of them, only the ones still in progress, or none, as the admin chooses.
-- Run once in the Supabase SQL editor after 0022. It adds one function; no data is changed until an admin uses it.

-- Still being worked on: not joined and not closed (same rule as stageOf() in lib/pipeline.ts).
create or replace function candidate_in_progress(c candidates) returns boolean
  language sql stable set search_path = public as $$
  select c.pipeline_status <> 'Joined'
     and c.pipeline_status not like 'Left%'
     and c.pipeline_status not like 'Screening Rejected%'
     and c.pipeline_status not in ('Wrong Number', 'Not Contactable', 'Scheduled Not Contactable',
       'Interview Scheduled - No Response', 'Not Selected - Not Suitable', 'Interview Not Selected - Dropped by Candidate',
       'Interview Rescheduled Not Attended', 'Selected Candidate Dropped')
$$;
revoke all on function candidate_in_progress(candidates) from public, anon;

-- Sets a store's HR and moves its candidates (p_move: 'all', 'open' or 'none'). Returns how many candidates moved.
-- A store's candidates are the ones allocated to it, plus online applicants not yet allocated who applied there.
create or replace function set_store_hr(p_branch uuid, p_hr text, p_move text default 'all') returns int
  language plpgsql security definer set search_path = public as $$
declare b branches; v_old text; n int := 0;
begin
  if not is_admin() then raise exception 'Only an admin can change which HR looks after a store'; end if;
  if p_move not in ('all', 'open', 'none') then raise exception 'p_move must be all, open or none'; end if;
  if not exists (select 1 from profiles where username = p_hr and role = 'hr') then raise exception '% is not an HR login', p_hr; end if;
  select * into b from branches where id = p_branch for update;
  if not found then raise exception 'store not found'; end if;
  v_old := b.hr_username;
  update branches set hr_username = p_hr where id = b.id;
  if p_move <> 'none' and v_old is distinct from p_hr then
    perform set_config('app.trusted', 'on', true);
    update candidates c set assigned_hr = p_hr
     where (c.branch_id = b.id or (c.branch_id is null and b.name = any (c.applied_locations)))
       and c.assigned_hr is distinct from p_hr
       and (p_move = 'all' or candidate_in_progress(c));
    get diagnostics n = row_count;
    perform set_config('app.trusted', 'off', true);
  end if;
  if v_old is distinct from p_hr then
    insert into notifications (sender, recipient, message)
    values ((me()).username, p_hr, 'You now look after ' || b.name || case when n > 0 then '; ' || n || ' of its candidates moved to you.' else '.' end);
    if v_old is not null then
      insert into notifications (sender, recipient, message)
      values ((me()).username, v_old, b.name || ' is now looked after by ' || p_hr || case when n > 0 then '; ' || n || ' of its candidates moved to them.' else '.' end);
    end if;
  end if;
  return n;
end $$;
revoke all on function set_store_hr(uuid, text, text) from public, anon;
grant execute on function set_store_hr(uuid, text, text) to authenticated;
