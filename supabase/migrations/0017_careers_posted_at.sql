-- Careers page: also return when admin last changed which posts are open, used as the job posting date
-- that Google for Jobs and AI assistants require. Safe to run before or after the code that reads it.
create or replace function public_careers() returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'urgent', coalesce((select jsonb_agg(jsonb_build_object('branch_id', m.branch_id, 'post', m.post, 'headcount', m.headcount))
                        from manpower_requests m where m.status = 'approved'), '[]'),
    'posted_at', (select updated_at from app_settings where key = 'branch_posts'))
$$;
revoke all on function public_careers() from public;
grant execute on function public_careers() to anon, authenticated;
