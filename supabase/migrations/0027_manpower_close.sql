-- Manpower requests, round 2 (varun, 30 Oct 2026):
--  * No "Urgently hiring" anywhere. An approved permanent request just keeps its post open, like any other post.
--    public_careers() no longer lists approved requests.
--  * A permanent request closes by itself when enough people have joined (status filled, as in 0026) or when its
--    needed-by date has passed (new status closed). The nightly reminder from 0026 is replaced by this.
--  * The store's HR (or an admin) closes a request by hand when ending it early (close_manpower_request).
--  * The store and its HR are told when a request closes, and a post that approval opened is closed again.
-- Run once in the Supabase SQL editor after 0026. It adds a status and replaces functions; no collected data is changed.

alter table manpower_requests drop constraint if exists manpower_requests_status_check;
alter table manpower_requests add constraint manpower_requests_status_check
  check (status in ('requested', 'approved', 'filled', 'closed', 'cancelled'));

create or replace function public_careers() returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('posted_at', (select updated_at from app_settings where key = 'branch_posts'))
$$;
revoke all on function public_careers() from public;
grant execute on function public_careers() to anon, authenticated;

-- Store and its HR are told when a permanent request is approved, filled, closed or cancelled.
create or replace function manpower_status_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_what text := new.headcount || ' × ' || new.post; v_msg text; v_hr text;
  v_store text := (select name from branches where id = new.branch_id);
  v_joined text := new.hired || ' of ' || new.headcount || ' joined';
begin
  if new.kind <> 'permanent' or new.status = old.status then return new; end if;
  v_msg := case new.status
    when 'approved' then 'Your manpower request (' || v_what || ') is approved. HR will start hiring.'
    when 'filled' then 'Your manpower request (' || v_what || ') is filled: ' || v_joined || '.'
    when 'closed' then 'Your manpower request (' || v_what || ') is closed' || coalesce(' (' || new.decision_note || ')', '') || ': ' || v_joined || '.'
    when 'cancelled' then 'Your manpower request (' || v_what || ') was cancelled.'
    else null end;
  if v_msg is null then return new; end if;
  if not coalesce((me()).role = 'branch' and (me()).branch_id = new.branch_id, false) then
    perform notify_store(new.branch_id, v_msg);
  end if;
  select hr_username into v_hr from branches where id = new.branch_id;
  if v_hr is not null and v_hr is distinct from actor_name() then
    insert into notifications (sender, recipient, message) values (actor_name(), v_hr, case new.status
      when 'approved' then 'Approved: hire ' || v_what || ' for ' || v_store
        || coalesce(' by ' || to_char(new.needed_by, 'DD/MM/YYYY'), '') || '. Joiners there are counted against it.'
      when 'closed' then 'Manpower request ' || v_what || ' for ' || v_store || ' is closed' || coalesce(' (' || new.decision_note || ')', '') || ': ' || v_joined || '.'
      else 'Manpower request ' || v_what || ' for ' || v_store || ' is ' || new.status || '.' end);
  end if;
  if new.status in ('filled', 'closed', 'cancelled') and old.opened_post
     and not exists (select 1 from manpower_requests o where o.id <> new.id and o.kind = 'permanent' and o.status = 'approved'
                       and o.branch_id = new.branch_id and o.post = new.post) then
    perform _set_branch_post(new.branch_id, new.post, false);
  end if;
  return new;
end $$;
revoke all on function manpower_status_notify() from public, anon, authenticated;

-- HR (or an admin) ends an approved permanent request early.
create or replace function close_manpower_request(p_request uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare m manpower_requests;
begin
  select * into m from manpower_requests where id = p_request and kind = 'permanent' for update;
  if m.id is null then raise exception 'Request not found'; end if;
  if not can_manage_store(m.branch_id) then raise exception 'Only this store''s HR or an admin can close it'; end if;
  if m.status <> 'approved' then raise exception 'Only an approved request can be closed'; end if;
  update manpower_requests set status = 'closed', decision_note = 'ended early by ' || actor_name(), updated_at = now() where id = m.id;
  perform log_change('close manpower request', m.id::text, jsonb_build_object('hired', m.hired));
end $$;
revoke all on function close_manpower_request(uuid) from public, anon;
grant execute on function close_manpower_request(uuid) to authenticated;

-- Nightly (from /api/cleanup): close permanent requests whose needed-by date has passed, and warn about temporary
-- requests starting without enough people (as in 0026). Returns how many requests it acted on.
create or replace function send_manpower_alerts() returns int
  language plpgsql security definer set search_path = public as $$
declare today date := ist_today(); m manpower_requests; v_have int; v_need int; n int := 0;
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  for m in select * from manpower_requests where kind = 'permanent' and status = 'approved' and needed_by < today loop
    update manpower_requests set status = 'closed', decision_note = 'needed-by date passed', updated_at = now() where id = m.id;
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
