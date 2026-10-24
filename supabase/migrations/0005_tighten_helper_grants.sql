-- These helpers are only used inside row level security for signed-in staff.
revoke execute on function me() from public, anon;
revoke execute on function is_admin() from public, anon;
revoke execute on function can_see_candidate(candidates) from public, anon;
grant execute on function me() to authenticated;
grant execute on function is_admin() to authenticated;
grant execute on function can_see_candidate(candidates) to authenticated;
