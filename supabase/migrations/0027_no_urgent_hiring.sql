-- No "Urgently hiring" anywhere (varun, 30 Oct 2026). An approved permanent request just keeps its post open, like any other.
--  * public_careers() no longer lists approved requests.
--  * The store's "approved" message no longer mentions urgent hiring.
-- Run once in the Supabase SQL editor after 0026. It replaces two functions only; no data is changed.

create or replace function public_careers() returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('posted_at', (select updated_at from app_settings where key = 'branch_posts'))
$$;
revoke all on function public_careers() from public;
grant execute on function public_careers() to anon, authenticated;

create or replace function manpower_status_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_what text := new.headcount || ' × ' || new.post; v_msg text; v_hr text;
begin
  if new.kind <> 'permanent' or new.status = old.status then return new; end if;
  v_msg := case new.status
    when 'approved' then 'Your manpower request (' || v_what || ') is approved. HR will start hiring, and the post is open on the careers page.'
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
