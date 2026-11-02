-- Candidate links (onboarding form, letters) used to run 60 days from when the candidate was created, so a slow hire
-- could find the link already expired by the time HR sent it. Now the 60 days start again whenever the candidate
-- reaches the offer / joining stages. A link that already runs longer is never shortened.
-- Named "zz" so it runs after candidates_guard (before-triggers run in name order), which stops staff editing the date by hand.

create or replace function candidates_zz_link_timer() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.pipeline_status is distinct from old.pipeline_status
     and new.pipeline_status in ('Selected / Offer Generated', 'Expected Joining', 'Revised Joining', 'Joined') then
    new.token_expires_at := greatest(new.token_expires_at, now() + interval '60 days');
  end if;
  return new;
end $$;
revoke all on function candidates_zz_link_timer() from public, anon, authenticated;
drop trigger if exists candidates_zz_link_timer on candidates;
create trigger candidates_zz_link_timer before update on candidates for each row execute function candidates_zz_link_timer();

-- One-off: people waiting to join whose onboarding form isn't in yet get a fresh 60 days now.
update candidates c set token_expires_at = greatest(c.token_expires_at, now() + interval '60 days')
where c.pipeline_status in ('Selected / Offer Generated', 'Expected Joining', 'Revised Joining')
  and not exists (select 1 from onboarding_submissions o where o.candidate_id = c.id and o.status <> 'pending');
