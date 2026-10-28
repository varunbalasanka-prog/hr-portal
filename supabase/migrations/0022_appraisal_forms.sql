-- Appraisal forms, part 2 (varun, 27 Oct 2026):
--  * Automobile stores now have an appraisal form (the draft varun approved), so their pay rises and promotions also go
--    through an appraisal interview, and late salary edits on their staff are refused like at jewellery stores.
--  * Admins can edit both forms on the Staff page. The edited form is saved here. Each appraisal keeps a copy of the form
--    it was filled on, so editing a form never changes past appraisals.
-- Run once in the Supabase SQL editor after 0020 (and 0021). It adds a table and changes one function; no data is changed.

create table if not exists appraisal_forms (
  kind       text primary key check (kind in ('jewellery', 'automobile')),
  form       jsonb not null,
  updated_by text not null,
  updated_at timestamptz not null default now()
);
alter table appraisal_forms enable row level security;
-- No salaries in a form, but store logins never take appraisals, so they don't need it.
drop policy if exists appraisal_forms_read on appraisal_forms;
create policy appraisal_forms_read on appraisal_forms for select to authenticated using (not is_store());
drop policy if exists appraisal_forms_admin_write on appraisal_forms;
create policy appraisal_forms_admin_write on appraisal_forms for all to authenticated using (is_admin()) with check (is_admin());

-- Which appraisal form a business type uses (lib/appraisal.ts kindFor()).
create or replace function appraisal_kind(p_business_type text) returns text
  language sql immutable set search_path = public as $$
  select case p_business_type when 'Jewellery' then 'jewellery' when 'Automobiles' then 'automobile' end
$$;
