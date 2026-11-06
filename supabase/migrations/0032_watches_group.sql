-- Run once in the Supabase SQL editor after PR "Watches & eyewear group" is live.
-- varun, 6 Nov 2026: Titan, Fastrack and Titan Eye+ showrooms get their own group, "Watches & eyewear",
-- and keep using the jewellery appraisal form and letter wording. Also fixes the Fastrack spelling and two role names.
-- Past applications and manpower requests keep the names they were made with.

create or replace function appraisal_kind(p_business_type text) returns text
  language sql immutable set search_path = public as $$
  select case p_business_type when 'Jewellery' then 'jewellery' when 'Watches & eyewear' then 'jewellery'
                              when 'Automobiles' then 'automobile' when 'Cycles' then 'automobile' end
$$;

update branches set name = 'Fastrack - Madurai' where name = 'Fast track - Madurai';
update branches set business_type = 'Watches & eyewear'
 where name in ('Fastrack - Madurai', 'Titan - Tenkasi', 'Eye plus - Tenkasi');

select _rename_job_role('House Keeping', 'Housekeeping') as housekeeping,
       _rename_job_role('Asst. Technical Executive', 'Assistant Technical Executive') as assistant;

select name, business_type, appraisal_kind(business_type) from branches where business_type = 'Watches & eyewear' order by name;
