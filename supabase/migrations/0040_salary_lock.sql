-- Salary lock (varun, 12 Nov 2026): once a candidate's salary is approved, only an admin (admin or superadmin, is_admin())
-- may change it. Before this, HR could re-send a "proposed" salary on an approved candidate, which silently un-approved it
-- and locked the offer letter again. Rules only, no data changes. Safe to run more than once.
--  * HR / store logins: after approval they can't touch basic_salary, allowances, proposed_basic, proposed_allowances,
--    salary_status, salary_approved_by or salary_approved_at. The database refuses with a clear message.
--  * Admins, the portal's own trusted steps (re-apply restart, appraisals) and server jobs work as before.
create or replace function candidates_salary_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or current_setting('app.trusted', true) = 'on' or is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if coalesce(new.basic_salary, 0) > 0 or coalesce(new.allowances, 0) > 0 then
      new.proposed_basic := new.basic_salary; new.proposed_allowances := new.allowances; new.salary_status := 'proposed';
    end if;
    new.basic_salary := 0; new.allowances := 0;
    if new.salary_status = 'approved' then new.salary_status := null; end if;
    new.salary_approved_by := null; new.salary_approved_at := null;
    return new;
  end if;
  -- Approved (salaries from before the approval step, with no status but a basic, count as approved too).
  if (old.salary_status = 'approved' or (old.salary_status is null and coalesce(old.basic_salary, 0) > 0))
     and (new.proposed_basic is distinct from old.proposed_basic or new.proposed_allowances is distinct from old.proposed_allowances
          or new.salary_status is distinct from old.salary_status) then
    raise exception 'This salary is already approved. Only an admin can change it now.';
  end if;
  if new.basic_salary is distinct from old.basic_salary or new.allowances is distinct from old.allowances
     or new.salary_approved_by is distinct from old.salary_approved_by or new.salary_approved_at is distinct from old.salary_approved_at
     or (new.salary_status = 'approved' and old.salary_status is distinct from 'approved') then
    raise exception 'Only an admin can set or approve the salary. Enter it as a proposal.';
  end if;
  return new;
end $$;
revoke all on function candidates_salary_guard() from public, anon, authenticated;
drop trigger if exists candidates_salary_guard on candidates;
create trigger candidates_salary_guard before insert or update on candidates for each row execute function candidates_salary_guard();
