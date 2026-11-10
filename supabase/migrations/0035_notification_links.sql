-- 0035: tapping a notification opens the thing it is about.
--
-- Each notification gets a `link` (a page inside the portal, e.g. /dashboard?open=<candidate id> or /manpower).
-- The app sets it where it knows the candidate. Notifications written by the database (applications, offers,
-- onboarding, manpower, appraisals, confirmations) are filled in by a trigger that reads the message:
--   * "<name> (<10-digit mobile>) ..."  -> that candidate (mobile is unique on candidates)
--   * manpower / temporary staff         -> /manpower
--   * appraisal / new employee / staff   -> /staff
-- Nothing else changes: messages, recipients and old rows keep their text. Safe to run more than once.

alter table notifications add column if not exists link text;

create or replace function notification_link_for(p_message text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_mobile text;
  v_id uuid;
begin
  if p_message is null then return null; end if;
  if p_message ~* '(manpower request|temporary staff|^approved: hire)' then return '/manpower'; end if;
  if p_message ~* '^(appraisal |new employee joined|staff list imported)' then return '/staff'; end if;
  v_mobile := substring(p_message from '\((\d{10})\)');
  if v_mobile is not null then
    select id into v_id from candidates where mobile = v_mobile limit 1;
    if v_id is not null then return '/dashboard?open=' || v_id; end if;
  end if;
  if p_message ~* '^re-apply folder' then return '/dashboard?list=reapply'; end if;
  if p_message ~* '^confirmation due' then return '/dashboard?list=confirmations'; end if;
  if p_message ~* '^salary approval needed' then return '/dashboard?list=approvals'; end if;
  return null;
end $$;
revoke all on function notification_link_for(text) from public, anon, authenticated;

create or replace function notifications_fill_link() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Only paths inside the portal; anything else is dropped so a message can never link off-site.
  if new.link is not null and new.link !~ '^/[a-z]' then new.link := null; end if;
  if new.link is null then new.link := notification_link_for(new.message); end if;
  return new;
end $$;
revoke all on function notifications_fill_link() from public, anon, authenticated;

drop trigger if exists notifications_fill_link on notifications;
create trigger notifications_fill_link before insert on notifications
  for each row execute function notifications_fill_link();

-- Give the notifications people already have a link too.
update notifications set link = notification_link_for(message) where link is null;
