-- Manpower request gaps (varun, 30 Oct 2026):
--  1. A permanent request now tells the store's HR as well as the admins (by the database, like temporary ones).
--  2. The store and its HR are told when a permanent request is approved, filled or cancelled.
--  3. Approving a permanent request opens that post at the store if it wasn't open, so the "Urgently hiring" label,
--     /apply and the Google job page all show it. If approval opened the post, it closes again with the request
--     (unless another approved request still needs that post there).
--  4. A candidate who joins at a store is counted against the oldest approved request there for the same post
--     (candidates.manpower_request_id). When enough people have joined, the request is marked filled by itself.
--  5. Nightly: an approved permanent request past its needed-by date (or 30 days old with none) reminds the store's
--     HR and the admins once; a temporary request starting tomorrow (or already started) that still lacks people does too.
--  6. Only the store's own HR (or an admin) may approve, staff or end a temporary request.
-- Run once in the Supabase SQL editor after 0025. It adds columns and functions only; no collected data is changed.

alter table manpower_requests add column if not exists approved_at timestamptz;
alter table manpower_requests add column if not exists hired int not null default 0;
alter table manpower_requests add column if not exists opened_post boolean not null default false;
alter table manpower_requests add column if not exists overdue_alerted_at timestamptz;
alter table manpower_requests add column if not exists start_alerted_at timestamptz;
alter table candidates add column if not exists manpower_request_id uuid references manpower_requests (id) on delete set null;
create index if not exists candidates_manpower on candidates (manpower_request_id) where manpower_request_id is not null;

-- Admins, or the HR who looks after this store (Admin > Store HR).
create or replace function can_manage_store(p_branch uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select is_admin() or coalesce((me()).role = 'hr'
    and (select coalesce(b.hr_username, (me()).username) = (me()).username from branches b where b.id = p_branch), false)
$$;
revoke all on function can_manage_store(uuid) from public, anon;
grant execute on function can_manage_store(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. New requests: the store's HR and the admins are told, permanent or temporary.
-- ---------------------------------------------------------------------------
create or replace function manpower_requested_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_store text := (select name from branches where id = new.branch_id);
begin
  if new.kind = 'temporary' then
    perform notify_request_deciders(new.branch_id, 'Temporary staff request from ' || v_store
      || ': ' || new.post || ', ' || to_char(new.start_date, 'DD/MM') || ' to ' || to_char(new.end_date, 'DD/MM/YYYY')
      || '. Approve and pick people on the Manpower page.');
  else
    perform notify_request_deciders(new.branch_id, 'Manpower request from ' || v_store || ': ' || new.headcount || ' × ' || new.post
      || coalesce(', needed by ' || to_char(new.needed_by, 'DD/MM/YYYY'), '') || '. An admin approves it on the Manpower page.');
  end if;
  return new;
end $$;
revoke all on function manpower_requested_notify() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Admin approves a permanent request; the post is opened at the store if it wasn't. Returns {"opened": bool}.
-- ---------------------------------------------------------------------------
-- Adds or removes one post in Store posts (app_settings.branch_posts); the 0024 trigger opens/closes the job listing.
create or replace function _set_branch_post(p_branch uuid, p_post text, p_open boolean) returns boolean
  language plpgsql security definer set search_path = public as $$
declare v jsonb; cur jsonb; k text := p_branch::text;
begin
  select value into v from app_settings where key = 'branch_posts' for update;
  v := coalesce(v, '{}');
  cur := case jsonb_typeof(v -> k) when 'array' then v -> k else '[]' end;
  if p_open = (cur ? p_post) then return false; end if;
  cur := case when p_open then cur || to_jsonb(p_post)
              else coalesce((select jsonb_agg(x) from jsonb_array_elements_text(cur) x where x <> p_post), '[]') end;
  insert into app_settings (key, value, updated_at) values ('branch_posts', jsonb_set(v, array[k], cur), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  return true;
end $$;
revoke all on function _set_branch_post(uuid, text, boolean) from public, anon, authenticated;

create or replace function approve_manpower_request(p_request uuid) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare m manpower_requests; v_opened boolean;
begin
  if not is_admin() then raise exception 'Only an admin can approve permanent requests'; end if;
  select * into m from manpower_requests where id = p_request and kind = 'permanent' for update;
  if m.id is null then raise exception 'Request not found'; end if;
  if m.status <> 'requested' then raise exception 'This request was already decided'; end if;
  v_opened := _set_branch_post(m.branch_id, m.post, true);
  -- Keep its job listing up for at least 30 more days, and until the needed-by date.
  update job_openings set closes_on = greatest(closes_on, ist_today() + 30, m.needed_by)
   where branch_id = m.branch_id and post = m.post and closed_at is null and closes_on is not null;
  update manpower_requests set status = 'approved', approved_at = now(), opened_post = v_opened, decided_by = actor_name(), updated_at = now()
   where id = m.id;
  perform log_change('approve manpower request', m.id::text, jsonb_build_object('opened_post', v_opened));
  return jsonb_build_object('opened', v_opened);
end $$;
revoke all on function approve_manpower_request(uuid) from public, anon;
grant execute on function approve_manpower_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Permanent request approved, filled or cancelled: tell the store and its HR. A post approval opened is closed again.
-- ---------------------------------------------------------------------------
create or replace function manpower_status_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_what text := new.headcount || ' × ' || new.post; v_msg text; v_hr text;
begin
  if new.kind <> 'permanent' or new.status = old.status then return new; end if;
  v_msg := case new.status
    when 'approved' then 'Your manpower request (' || v_what || ') is approved. HR will start hiring, and it shows as urgently hiring on the careers page.'
    when 'filled' then 'Your manpower request (' || v_what || ') is filled' || case when new.hired > 0 then ': ' || new.hired || ' joined.' else '.' end
    when 'cancelled' then 'Your manpower request (' || v_what || ') was cancelled.'
    else null end;
  if v_msg is null then return new; end if;
  if not coalesce((me()).role = 'branch' and (me()).branch_id = new.branch_id, false) then
    perform notify_store(new.branch_id, v_msg);
  end if;
  select hr_username into v_hr from branches where id = new.branch_id;
  if v_hr is not null and v_hr is distinct from actor_name() then
    insert into notifications (sender, recipient, message) values (actor_name(), v_hr, case new.status
      when 'approved' then 'Approved: hire ' || v_what || ' for ' || (select name from branches where id = new.branch_id)
        || coalesce(' by ' || to_char(new.needed_by, 'DD/MM/YYYY'), '') || '. Joiners there are counted against it.'
      else 'Manpower request ' || v_what || ' for ' || (select name from branches where id = new.branch_id) || ' is ' || new.status || '.' end);
  end if;
  if new.status in ('filled', 'cancelled') and old.opened_post
     and not exists (select 1 from manpower_requests o where o.id <> new.id and o.kind = 'permanent' and o.status = 'approved'
                       and o.branch_id = new.branch_id and o.post = new.post) then
    perform _set_branch_post(new.branch_id, new.post, false);
  end if;
  return new;
end $$;
revoke all on function manpower_status_notify() from public, anon, authenticated;
drop trigger if exists manpower_status_notify on manpower_requests;
create trigger manpower_status_notify after update on manpower_requests for each row execute function manpower_status_notify();

-- ---------------------------------------------------------------------------
-- 4. A candidate joins: count them against the oldest approved request at that store for the same post.
-- Named to run after the other candidate triggers. Only admins may change the link by hand.
-- ---------------------------------------------------------------------------
create or replace function candidates_zz_manpower() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_post text := coalesce(nullif(trim(new.designation), ''), new.posts[1]); v_req uuid;
begin
  if new.manpower_request_id is distinct from old.manpower_request_id and auth.uid() is not null and not is_admin() then
    new.manpower_request_id := old.manpower_request_id;
  end if;
  if new.pipeline_status <> 'Joined' or old.pipeline_status = 'Joined' or new.manpower_request_id is not null
     or new.branch_id is null or v_post is null then
    return new;
  end if;
  select id into v_req from manpower_requests
   where kind = 'permanent' and status = 'approved' and branch_id = new.branch_id and lower(post) = lower(v_post) and hired < headcount
   order by coalesce(approved_at, created_at) limit 1 for update;
  if v_req is null then return new; end if;
  new.manpower_request_id := v_req;
  update manpower_requests set hired = hired + 1, updated_at = now(),
         status = case when hired + 1 >= headcount then 'filled' else status end
   where id = v_req;
  return new;
end $$;
revoke all on function candidates_zz_manpower() from public, anon, authenticated;
drop trigger if exists candidates_zz_manpower on candidates;
create trigger candidates_zz_manpower before update on candidates for each row execute function candidates_zz_manpower();

-- ---------------------------------------------------------------------------
-- 5. Nightly (from /api/cleanup). Each alert is sent once per request.
-- ---------------------------------------------------------------------------
create or replace function send_manpower_alerts() returns int
  language plpgsql security definer set search_path = public as $$
declare today date := ist_today(); m manpower_requests; v_have int; v_need int; n int := 0;
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  for m in select * from manpower_requests where kind = 'permanent' and status = 'approved' and overdue_alerted_at is null
             and (needed_by < today or (needed_by is null and coalesce(approved_at, created_at) < now() - interval '30 days')) loop
    update manpower_requests set overdue_alerted_at = now() where id = m.id;
    perform notify_request_deciders(m.branch_id, 'Still open: ' || m.headcount || ' × ' || m.post || ' for '
      || (select name from branches where id = m.branch_id) || ', ' || m.hired || ' joined so far'
      || coalesce(', needed by ' || to_char(m.needed_by, 'DD/MM/YYYY'), '') || '. Keep hiring, or mark it filled or cancel it on the Manpower page.');
    n := n + 1;
  end loop;
  for m in select * from manpower_requests where kind = 'temporary' and status = 'approved' and start_alerted_at is null
             and start_date <= today + 1 and end_date >= today loop
    select count(*) into v_have from staff_loans where request_id = m.id;
    select sum((x->>'headcount')::int) into v_need from jsonb_array_elements(m.roles) x;
    update manpower_requests set start_alerted_at = now() where id = m.id;
    perform notify_request_deciders(m.branch_id, 'Temporary staff for ' || (select name from branches where id = m.branch_id)
      || ' start ' || to_char(m.start_date, 'DD/MM') || ' but only ' || v_have || ' of ' || v_need
      || ' people are picked. Pick the rest on the Manpower page.');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function send_manpower_alerts() from public, anon;
grant execute on function send_manpower_alerts() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Temporary requests: only the store's own HR (or an admin) decides, picks people and ends loans.
-- Same as 0021 apart from the can_manage_store() check.
-- ---------------------------------------------------------------------------
create or replace function loan_pool(p_request uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare m manpower_requests;
begin
  if not is_hr_or_admin() then raise exception 'Only HR or an admin can pick people'; end if;
  select * into m from manpower_requests where id = p_request and kind = 'temporary';
  if m.id is null then raise exception 'Request not found'; end if;
  if not can_manage_store(m.branch_id) then raise exception 'Only this store''s HR or an admin can do this'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
        'employment_id', em.id, 'name', e.name, 'employee_code', em.employee_code, 'designation', ep.designation,
        'branch_id', ep.branch_id,
        'busy', (select jsonb_agg(jsonb_build_object('to_branch_id', l.to_branch_id, 'start_date', l.start_date, 'end_date', loan_last_day(l)))
                 from staff_loans l where l.employment_id = em.id and l.request_id <> m.id
                   and l.start_date <= m.end_date and loan_last_day(l) >= m.start_date))
      order by e.name), '[]'::jsonb)
    from employments em join employees e on e.id = em.employee_id
    join employee_positions ep on ep.employment_id = em.id and ep.to_date is null
    where em.left_on is null and ep.branch_id <> m.branch_id);
end $$;
revoke all on function loan_pool(uuid) from public, anon;
grant execute on function loan_pool(uuid) to authenticated;

create or replace function decide_temp_request(p_request uuid, p_approve boolean, p_note text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare m manpower_requests;
begin
  if not is_hr_or_admin() then raise exception 'Only HR or an admin can decide'; end if;
  select * into m from manpower_requests where id = p_request and kind = 'temporary' for update;
  if m.id is null then raise exception 'Request not found'; end if;
  if not can_manage_store(m.branch_id) then raise exception 'Only this store''s HR or an admin can do this'; end if;
  if m.status <> 'requested' then raise exception 'This request was already decided'; end if;
  update manpower_requests set status = case when p_approve then 'approved' else 'cancelled' end, decided_by = actor_name(),
         decision_note = nullif(trim(coalesce(p_note, '')), ''), updated_at = now() where id = m.id;
  perform notify_store(m.branch_id, case when p_approve
    then 'Your temporary staff request (' || m.post || ') is approved. HR is picking the people.'
    else 'Your temporary staff request (' || m.post || ') was not approved' || coalesce(': ' || nullif(trim(coalesce(p_note, '')), ''), '.') end);
  perform log_change(case when p_approve then 'approve temporary staff' else 'decline temporary staff' end, m.id::text, jsonb_build_object('note', p_note));
end $$;
revoke all on function decide_temp_request(uuid, boolean, text) from public, anon;
grant execute on function decide_temp_request(uuid, boolean, text) to authenticated;

create or replace function assign_temp_staff(p_request uuid, p_people jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  m manpower_requests; r jsonb; v_em uuid; v_post text; v_from uuid; v_name text; v_need int; v_have int;
  added int := 0; lenders jsonb := '{}'; names text := ''; k text; v_store text;
begin
  if not is_hr_or_admin() then raise exception 'Only HR or an admin can send people'; end if;
  select * into m from manpower_requests where id = p_request and kind = 'temporary' for update;
  if m.id is null then raise exception 'Request not found'; end if;
  if not can_manage_store(m.branch_id) then raise exception 'Only this store''s HR or an admin can do this'; end if;
  if m.status not in ('approved', 'filled') then raise exception 'Approve the request first'; end if;
  if m.end_date < ist_today() then raise exception 'This request has already ended'; end if;
  select name into v_store from branches where id = m.branch_id;

  for r in select * from jsonb_array_elements(coalesce(p_people, '[]')) loop
    v_em := (r->>'employment_id')::uuid;
    v_post := trim(coalesce(r->>'post', ''));
    select (x->>'headcount')::int into v_need from jsonb_array_elements(m.roles) x where x->>'post' = v_post;
    if v_need is null then raise exception 'Role "%" is not in this request', v_post; end if;
    select count(*) into v_have from staff_loans where request_id = m.id and post = v_post;
    if v_have >= v_need then raise exception 'Role "%" already has the % people asked for', v_post, v_need; end if;

    select ep.branch_id, e.name into v_from, v_name
      from employments em join employees e on e.id = em.employee_id
      join employee_positions ep on ep.employment_id = em.id and ep.to_date is null
      where em.id = v_em and em.left_on is null;
    if v_from is null then raise exception 'That person is not working at any store now'; end if;
    if v_from = m.branch_id then raise exception '% already works at %', v_name, v_store; end if;
    if exists (select 1 from staff_loans l where l.employment_id = v_em
               and l.start_date <= m.end_date and loan_last_day(l) >= greatest(m.start_date, ist_today())) then
      raise exception '% is already lent out on some of these days', v_name;
    end if;

    -- A request picked up after it started lends people from today.
    insert into staff_loans (request_id, employment_id, post, from_branch_id, to_branch_id, start_date, end_date, assigned_by)
    values (m.id, v_em, v_post, v_from, m.branch_id, greatest(m.start_date, ist_today()), m.end_date, actor_name());
    added := added + 1;
    names := names || case when names = '' then '' else ', ' end || v_name || ' (' || v_post || ')';
    lenders := jsonb_set(lenders, array[v_from::text], coalesce(lenders->v_from::text, '[]') || to_jsonb(v_name));
  end loop;
  if added = 0 then return jsonb_build_object('added', 0); end if;

  update manpower_requests set
    status = case when (select count(*) from staff_loans where request_id = m.id)
                       >= (select sum((x->>'headcount')::int) from jsonb_array_elements(m.roles) x) then 'filled' else 'approved' end,
    decided_by = coalesce(decided_by, actor_name()), updated_at = now()
  where id = m.id;

  perform notify_store(m.branch_id, 'Temporary staff coming to you from ' || to_char(greatest(m.start_date, ist_today()), 'DD/MM')
    || ' to ' || to_char(m.end_date, 'DD/MM/YYYY') || ': ' || names || '.');
  for k in select jsonb_object_keys(lenders) loop
    perform notify_store(k::uuid, 'HR is lending ' || (select string_agg(n, ', ') from jsonb_array_elements_text(lenders->k) n)
      || ' to ' || v_store || ' from ' || to_char(greatest(m.start_date, ist_today()), 'DD/MM') || ' to ' || to_char(m.end_date, 'DD/MM/YYYY')
      || '. They come back after that.');
  end loop;
  perform log_change('lend staff', m.id::text, jsonb_build_object('people', p_people));
  return jsonb_build_object('added', added);
end $$;
revoke all on function assign_temp_staff(uuid, jsonb) from public, anon;
grant execute on function assign_temp_staff(uuid, jsonb) to authenticated;

create or replace function end_staff_loan(p_loan uuid, p_last_day date default null) returns void
  language plpgsql security definer set search_path = public as $$
declare l staff_loans; v_name text; v_last date := coalesce(p_last_day, ist_today());
begin
  if not is_hr_or_admin() then raise exception 'Only HR or an admin can change a loan'; end if;
  select * into l from staff_loans where id = p_loan for update;
  if l.id is null then raise exception 'Loan not found'; end if;
  if not can_manage_store(l.to_branch_id) then raise exception 'Only this store''s HR or an admin can do this'; end if;
  select e.name into v_name from employments em join employees e on e.id = em.employee_id where em.id = l.employment_id;
  if v_last < l.start_date then
    delete from staff_loans where id = l.id;
    update manpower_requests set status = 'approved', updated_at = now() where id = l.request_id and status = 'filled';
    perform notify_store(l.to_branch_id, v_name || ' will no longer come to you on loan.');
    perform notify_store(l.from_branch_id, v_name || ' is no longer being lent out; they stay with you.');
  else
    if v_last > l.end_date then raise exception 'The last day must be within the loan'; end if;
    update staff_loans set returned_on = v_last where id = l.id;
    perform notify_store(l.to_branch_id, v_name || '''s last day with you is ' || to_char(v_last, 'DD/MM/YYYY') || '.');
    perform notify_store(l.from_branch_id, v_name || ' comes back to you after ' || to_char(v_last, 'DD/MM/YYYY') || '.');
  end if;
  perform log_change('end staff loan', l.id::text, jsonb_build_object('last_day', v_last));
end $$;
revoke all on function end_staff_loan(uuid, date) from public, anon;
grant execute on function end_staff_loan(uuid, date) to authenticated;
