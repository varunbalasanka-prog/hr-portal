-- 0032: a phone number for each showroom on balasanka.in, and the softer solar-dryer line on the About page.
-- Safe to run more than once. Run it in the Supabase SQL editor, then merge the pull request.

-- 1. Phone per showroom (typed on Website > Showrooms; empty = no phone shown).
alter table site_showrooms add column if not exists phone text
  check (phone is null or length(phone) <= 20);

-- 2. About page timeline: "Asia's first solar dryer" -> "an early solar dryer" (varun, 6 Nov 2026).
update site_content
   set value = replace(value::text, 'Asia''s first solar dryer', 'an early solar dryer')::jsonb
 where key = 'about' and value::text like '%Asia''s first solar dryer%';

-- Check: phone column exists, and the About text no longer says "Asia's first".
select
  (select count(*) from information_schema.columns where table_name = 'site_showrooms' and column_name = 'phone') as phone_column_added,
  (select count(*) from site_content where key = 'about' and value::text like '%Asia''s first%') as asia_claim_left;
