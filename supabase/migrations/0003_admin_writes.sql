-- Admins (including the Sheet sync account) can write onboarding rows and send notifications
-- from any sender name, e.g. "HR Portal" for the 15-minute sync summary.
create policy onboarding_admin on onboarding_submissions for all to authenticated
  using (is_admin()) with check (is_admin());
create policy notifications_admin_insert on notifications for insert to authenticated
  with check (is_admin());
