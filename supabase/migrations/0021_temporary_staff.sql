-- Festival temporary staff (varun, 27 Oct 2026):
--  * In the Manpower tab a store can ask for Temporary staff: one or more roles, how many people for each, and the
--    dates. Temporary requests never show on the public careers page.
--  * The store's HR (or an admin) approves and picks named people from other stores, automobile or jewellery. The
--    lending stores and the borrowing store are told who is coming and when.
--  * A loan is a dated line of its own (staff_loans). The person's home store does not change, so loans are not
--    transfers and do not count as attrition.
--  * On the last day the people go back automatically. There are no extensions: a store that needs more help raises
--    a new request. HR can still send someone back early.
-- Run once in the Supabase SQL editor, after 0019 (0020 is not needed first). It adds columns, a table and functions only; no collected data is changed.

-- ---------------------------------------------------------------------------
-- Temporary requests live in manpower_requests next to the permanent ones.
-- roles = [{"post": "Sales Executive", "headcount": 2}, ...]; post/headcount hold a summary and the total.
-- ---------------------------------------------------------------------------
alter table manpower_requests add column if not exists kind text not null default 'permanent';
alter table manpower_requests add column if not exists roles jsonb;
alter table manpower_requests add column if not exists start_date date;
alter table manpower_requests add column if not exists end_date date;
alter table manpower_requests add column if not exists decision_note text;
alter table manpower_requests add column if not exists ending_alerted_at timestamptz;
alter table manpower_requests drop constraint if exists manpower_kind;
alter table manpower_requests add constraint manpower_kind check (kind in ('permanent', 'temporary'));
alter table manpower_requests drop constraint if exists manpower_temporary_shape;
alter table manpower_requests add constraint manpower_temporary_shape check (
  kind = 'permanent' or (jsonb_typeof(roles) = 'array' and jsonb_array_length(roles) > 0
                         and start_date is not null and end_date is not null and end_date >= start_date));

-- Careers page: only permanent requests are "urgently hiring".
create or replace function public_careers() returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'urgent', coalesce((select jsonb_agg(jsonb_build_object('branch_id', m.branch_id, 'post', m.post, 'headcount', m.headcount))
                        from manpower_requests m where m.status = 'approved' and m.kind = 'permanent'), '[]'),
    'posted_at', (select updated_at from app_settings where key = 'branch_posts'))
$$;
revoke all on function public_careers() from public;
grant execute on function public_careers() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Who is lent where. Last day = returned_on (sent back early) or end_date.
-- ---------------------------------------------------------------------------
create table if not exists staff_loans (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null references manpower_requests (id) on delete cascade,
  employment_id    uuid not null references employments (id) on delete cascade,
  post             text not null,                -- the role they cover at the borrowing store
  from_branch_id   uuid not null references branches (id),
  to_branch_id     uuid not null references branches (id),
  start_date       date not null,
  end_date         date not null,
  returned_on      date,
  assigned_by      text not null,
  return_alerted_at timestamptz,
  created_at       timestamptz not null default now(),
  check (end_date >= start_date),
  check (returned_on is null or returned_on between start_date and end_date),
  check (from_branch_id <> to_branch_id)
);
create index if not exists staff_loans_request on staff_loans (request_id);
create index if not exists staff_loans_employment on staff_loans (employment_id, start_date);
create index if not exists staff_loans_branches on staff_loans (to_branch_id, from_branch_id);
-- Read through staff_loans_list() (it adds names); admins may read the table for exports.
alter table staff_loans enable row level security;
drop policy if exists staff_loans_admin_read on staff_loans;
create policy staff_loans_admin_read on staff_loans for select to authenticated using (is_admin());

create or replace function is_hr_or_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select is_admin() or coalesce((me()).role = 'hr', false)
$$;
revoke all on function is_hr_or_admin() from public, anon;

-- One notification to every login of a store.
create or replace function notify_store(p_branch uuid, p_message text) returns void
  language sql security definer set search_path = public as $$
  insert into notifications (sender, recipient, message)
  select actor_name(), p.username, p_message from profiles p where p.role = 'branch' and p.branch_id = p_branch
$$;
revoke all on function notify_store(uuid, text) from public, anon, authenticated;

-- HR of the borrowing store plus every admin.
create or replace function notify_request_deciders(p_branch uuid, p_message text) returns void
  language sql security definer set search_path = public as $$
  insert into notifications (sender, recipient, message)
  select actor_name(), u, p_message from (
    select hr_username as u from branches where id = p_branch and hr_username is not null
    union select username from profiles where role in ('admin', 'superadmin')) x
  where u is distinct from actor_name()
$$;
revoke all on function notify_request_deciders(uuid, text) from public, anon, authenticated;

create or replace function loan_last_day(l staff_loans) returns date
  language sql immutable as $$ select coalesce(l.returned_on, l.end_date) $$;

-- The store asks: tell its HR and the admins (the insert itself goes through the manpower_insert policy).
create or replace function manpower_requested_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'temporary' then
    perform notify_request_deciders(new.branch_id, 'Temporary staff request from ' || (select name from branches where id = new.branch_id)
      || ': ' || new.post || ', ' || to_char(new.start_date, 'DD/MM') || ' to ' || to_char(new.end_date, 'DD/MM/YYYY')
      || '. Approve and pick people on the Manpower page.');
  end if;
  return new;
end $$;
revoke all on function manpower_requested_notify() from public, anon, authenticated;
drop trigger if exists manpower_requested_notify on manpower_requests;
create trigger manpower_requested_notify after insert on manpower_requests for each row execute function manpower_requested_notify();

-- ---------------------------------------------------------------------------
-- Loans the caller may see, with names. HR and admins see all; a store sees people lent to it or by it.
-- ---------------------------------------------------------------------------
create or replace function staff_loans_list(p_request uuid default null) returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'request_id', l.request_id, 'employment_id', l.employment_id, 'post', l.post,
      'name', e.name, 'employee_code', em.employee_code, 'mobile', case when is_store() then null else e.mobile end,
      'designation', (select ep.designation from employee_positions ep where ep.employment_id = l.employment_id and ep.from_date <= l.start_date
                      order by ep.from_date desc, ep.id desc limit 1),
      'from_branch_id', l.from_branch_id, 'to_branch_id', l.to_branch_id,
      'start_date', l.start_date, 'end_date', l.end_date, 'returned_on', l.returned_on, 'assigned_by', l.assigned_by)
    order by l.start_date desc, e.name), '[]'::jsonb)
  from staff_loans l join employments em on em.id = l.employment_id join employees e on e.id = em.employee_id
  where (p_request is null or l.request_id = p_request)
    and (is_hr_or_admin() or (is_store() and (me()).branch_id in (l.from_branch_id, l.to_branch_id)))
$$;
revoke all on function staff_loans_list(uuid) from public, anon;
grant execute on function staff_loans_list(uuid) to authenticated;

-- People HR can lend for a request: everyone working today at another store, and whether they are already lent
-- for any of the requested days.
create or replace function loan_pool(p_request uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare m manpower_requests;
begin
  if not is_hr_or_admin() then raise exception 'Only HR or an admin can pick people'; end if;
  select * into m from manpower_requests where id = p_request and kind = 'temporary';
  if m.id is null then raise exception 'Request not found'; end if;
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

-- ---------------------------------------------------------------------------
-- HR approves or turns down a temporary request.
-- ---------------------------------------------------------------------------
create or replace function decide_temp_request(p_request uuid, p_approve boolean, p_note text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare m manpower_requests;
begin
  if not is_hr_or_admin() then raise exception 'Only HR or an admin can decide'; end if;
  select * into m from manpower_requests where id = p_request and kind = 'temporary' for update;
  if m.id is null then raise exception 'Request not found'; end if;
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

-- ---------------------------------------------------------------------------
-- HR sends people: p_people = [{"employment_id": "...", "post": "Sales Executive"}, ...]
-- ---------------------------------------------------------------------------
create or replace function assign_temp_staff(p_request uuid, p_people jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  m manpower_requests; r jsonb; v_em uuid; v_post text; v_from uuid; v_name text; v_need int; v_have int;
  added int := 0; lenders jsonb := '{}'; names text := ''; k text; v_store text;
begin
  if not is_hr_or_admin() then raise exception 'Only HR or an admin can send people'; end if;
  select * into m from manpower_requests where id = p_request and kind = 'temporary' for update;
  if m.id is null then raise exception 'Request not found'; end if;
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

-- HR takes someone off a loan: before it starts the line is removed; otherwise p_last_day becomes their last day there.
create or replace function end_staff_loan(p_loan uuid, p_last_day date default null) returns void
  language plpgsql security definer set search_path = public as $$
declare l staff_loans; v_name text; v_last date := coalesce(p_last_day, ist_today());
begin
  if not is_hr_or_admin() then raise exception 'Only HR or an admin can change a loan'; end if;
  select * into l from staff_loans where id = p_loan for update;
  if l.id is null then raise exception 'Loan not found'; end if;
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

-- ---------------------------------------------------------------------------
-- Nightly (from /api/cleanup): two days before the end, remind the borrowing store when its people go back; after
-- the last day, tell both stores the person is back home. Each alert is sent once.
-- ---------------------------------------------------------------------------
create or replace function send_loan_alerts() returns int
  language plpgsql security definer set search_path = public as $$
declare today date := ist_today(); m manpower_requests; l staff_loans; v_name text; n int := 0;
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  for m in select * from manpower_requests where kind = 'temporary' and status in ('approved', 'filled') and ending_alerted_at is null
             and end_date between today and today + 2
             and exists (select 1 from staff_loans where request_id = manpower_requests.id and returned_on is null) loop
    update manpower_requests set ending_alerted_at = now() where id = m.id;
    perform notify_store(m.branch_id, 'Your temporary staff (' || m.post || ') go back after ' || to_char(m.end_date, 'DD/MM/YYYY')
      || '. If you still need help after that, raise a new temporary request.');
    n := n + 1;
  end loop;
  for l in select * from staff_loans where return_alerted_at is null and coalesce(returned_on, end_date) < today loop
    update staff_loans set return_alerted_at = now() where id = l.id;
    select e.name into v_name from employments em join employees e on e.id = em.employee_id where em.id = l.employment_id;
    perform notify_store(l.from_branch_id, v_name || '''s loan to ' || (select name from branches where id = l.to_branch_id)
      || ' is over. They are back with you from today.');
    perform notify_store(l.to_branch_id, v_name || '''s loan with you is over. They have gone back to '
      || (select name from branches where id = l.from_branch_id) || '.');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function send_loan_alerts() from public, anon;
grant execute on function send_loan_alerts() to authenticated;
