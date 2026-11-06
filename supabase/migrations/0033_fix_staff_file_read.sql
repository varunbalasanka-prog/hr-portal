-- HR could not open onboarding documents or application files; only admins could.
-- Cause: inside these storage policies, a bare "name" bound to candidates.name
-- (the candidate's name) instead of storage.objects.name (the file path),
-- so the check never matched. Qualify it as objects.name.
-- Who can read is unchanged: anyone who can see the candidate (assigned HR, admins),
-- never store logins for onboarding documents.

drop policy if exists onboarding_staff_read on storage.objects;
create policy onboarding_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'onboarding-docs' and not is_store() and exists (
    select 1 from onboarding_submissions o join candidates c on c.id = o.candidate_id
    where can_see_candidate(c) and (objects.name in (select value from jsonb_each_text(o.files))
                                    or c.access_token::text = (storage.foldername(objects.name))[1])));

drop policy if exists apply_staff_read on storage.objects;
create policy apply_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'applications' and (
    exists (select 1 from candidates c
            where c.application_folder::text = (storage.foldername(objects.name))[1] and can_see_candidate(c))
    or exists (select 1 from applications a join candidates c on c.id = a.candidate_id
               where a.folder::text = (storage.foldername(objects.name))[1] and can_see_candidate(c))));
