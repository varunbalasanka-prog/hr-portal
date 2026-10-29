-- Job listings for Google for Jobs (one page per post per store) and the facts each listing needs.
-- 1. job_openings: one row per post opened at a store, kept in step with the admin "Posts open at each store"
--    screen by a trigger. opened_at is the real posting date (datePosted) and never changes on rebuilds; closes_on
--    (validThrough) and the monthly salary range are set per job by admin.
-- 2. job_roles: the company's roles and what each involves (summary, duties, requirements, shift, benefits). Drafts below; edit in Admin.
-- 3. branches.street_address / postal_code for the job address, filled from the existing address line.
-- 4. "Balasanka Cycle - Theni" becomes business type "Cycles" (keeps the automobile appraisal form).
-- 5. public_jobs(): open, unexpired jobs for the public job pages, sitemap and llms.txt.
-- Safe to run once; re-running is harmless.

-- 3. Store address parts --------------------------------------------------------------------------------------
alter table branches add column if not exists street_address text;
alter table branches add column if not exists postal_code text check (postal_code is null or postal_code ~ '^[0-9]{6}$');

update branches set street_address = 'Madurai Road, Cotton Market', postal_code = '626117' where name = 'Akshaya Velli - Rajapalayam' and street_address is null;
update branches set street_address = '200 B Tiruthangal Road', postal_code = '626123' where name = 'Akshaya Velli - Sivakasi' and street_address is null;
update branches set street_address = 'No 154/42/20 Railway Road', postal_code = '627811' where name = 'Akshaya Velli - Tenkasi' and street_address is null;
update branches set street_address = 'No 441/2A Balasanka Plaza, Periyakulam Road', postal_code = '625531' where name = 'Akshaya Velli - Theni' and street_address is null;
update branches set street_address = '167 Trivandrum Road, Murugankuruchi, Palayamkottai', postal_code = '627002' where name = 'Akshaya Velli - Tirunelveli' and street_address is null;
update branches set street_address = 'No 339 Rathnam Nagar, Periyakulam Road', postal_code = '625531' where name = 'Balasanka Cycle - Theni' and street_address is null;
update branches set street_address = 'No 441 Virudhunagar Road', postal_code = '626123' where name = 'Balasanka TVS - Sivakasi' and street_address is null;
update branches set street_address = 'No 18 Housing Board Colony, Madurai Road', postal_code = '627811' where name = 'Balasanka TVS - Tenkasi' and street_address is null;
update branches set street_address = '97/2 Katcheri Road', postal_code = '626001' where name = 'Balasanka TVS - Virudhunagar' and street_address is null;
update branches set street_address = '1396 Nehruji Road, Periyakulam Main Road', postal_code = '625531' where name = 'Balasanka Zora - Theni' and street_address is null;
update branches set street_address = '200 A Thiruthangal Main Road', postal_code = '626123' where name = 'Caratlane - Sivakasi' and street_address is null;
update branches set street_address = 'No 1539/2 Nehruji road, Periyakulam Main Road, Municipal Office Opposite', postal_code = '625531' where name = 'Caratlane - Theni' and street_address is null;
update branches set street_address = '166 Trivandrum Road, Palayamkottai, Murugankuruchi', postal_code = '627002' where name = 'Caratlane - Tirunelveli' and street_address is null;
update branches set street_address = '154/21 Railway Road', postal_code = '627811' where name = 'Eye plus - Tenkasi' and street_address is null;
update branches set street_address = '11 Anna salai 80 ft Road, Bye Pass Main road, KK nagar Zone 2 KK Nagar', postal_code = '625020' where name = 'Fast track - Madurai' and street_address is null;
update branches set street_address = '11 Anna salai 80 ft Road, Bye Pass Main road, KK nagar Zone 2 KK Nagar', postal_code = '625020' where name = 'Mia - Madurai' and street_address is null;
update branches set street_address = '1064/A Tenkasi Road, Near Cotton Market', postal_code = '626117' where name = 'Mukesh Honda - Rajapalayam' and street_address is null;
update branches set street_address = '462/1 Virudhunagar Road, Thiruthangal', postal_code = '626130' where name = 'Mukesh Honda - Sivakasi' and street_address is null;
update branches set street_address = '61/2 61/3 61/4 Madurai Main Road, Ramakrishnapuram', postal_code = '626135' where name = 'Mukesh Honda - Srivilliputhur' and street_address is null;
update branches set street_address = 'W8/158 Rathinam Nagar, Periyakulam Road', postal_code = '625531' where name = 'Shri Murugesan TVS - Theni' and street_address is null;
update branches set street_address = 'No 554/3 And 1693/2C Periyakulam Road', postal_code = '625531' where name = 'Tanishq - Theni' and street_address is null;
update branches set street_address = '154/21 Railway Road', postal_code = '627811' where name = 'Titan - Tenkasi' and street_address is null;
update branches set street_address = '336/2 Periyakulam Road, Unjampatti', postal_code = '625531' where name = 'Yasotha Motors - Theni' and street_address is null;

-- 4. Cycles ----------------------------------------------------------------------------------------------------
update branches set business_type = 'Cycles' where name = 'Balasanka Cycle - Theni';
-- Cycle staff keep the automobile appraisal form (lib/appraisal.ts kindFor() matches).
create or replace function appraisal_kind(p_business_type text) returns text
  language sql immutable set search_path = public as $$
  select case p_business_type when 'Jewellery' then 'jewellery' when 'Automobiles' then 'automobile' when 'Cycles' then 'automobile' end
$$;

-- 2. Role details ----------------------------------------------------------------------------------------------
-- Shared with the company role list (0025 imports the full list and adds which roles exist at each store).
create table if not exists job_roles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,        -- same text as the post names on the apply form
  business_type text,                       -- Jewellery / Automobiles / Cycles / Office, or null for any
  active       boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now(),
  summary      text not null default '',
  duties       text not null default '',   -- one per line
  requirements text not null default '',   -- one per line
  shift        text not null default '',   -- e.g. "9:30 AM to 8:30 PM, 6 days a week"
  benefits     text not null default '',   -- one per line
  updated_at   timestamptz not null default now()
);
alter table job_roles enable row level security;
drop policy if exists job_roles_read on job_roles;
create policy job_roles_read on job_roles for select to authenticated using (true);
drop policy if exists job_roles_admin on job_roles;
create policy job_roles_admin on job_roles for all to authenticated using (is_admin()) with check (is_admin());

insert into job_roles (name, summary, duties, requirements, benefits) values
  ('Executive Sales', 'Meet customers in the showroom, understand what they need and help them choose and buy.', 'Greet walk-in customers and explain products, prices and offers
Follow up on enquiries by phone and WhatsApp
Reach monthly sales targets
Keep the display area neat and stock details updated', 'Good communication in Tamil; basic English is a plus
Freshers and experienced candidates can apply', 'PF and ESI as per government rules'),
  ('Retail Sales Officer', 'Sell jewellery to showroom customers and give them a good buying experience.', 'Show designs and explain purity, weight, making charges and offers
Help customers with billing, exchange and schemes
Build repeat customers and follow up on enquiries
Keep trays, tags and counters in order', 'Good communication in Tamil
Retail or jewellery sales experience is a plus; freshers can apply', 'PF and ESI as per government rules'),
  ('Jewellery Consultant', 'Guide customers through jewellery choices for weddings, gifting and daily wear.', 'Understand the customer''s budget and occasion and suggest designs
Explain gold rate, purity (BIS hallmark), making charges and offers
Handle custom orders and follow up until delivery
Maintain counter stock and tag details', 'Interest in jewellery and good communication in Tamil
Jewellery sales experience preferred; freshers can apply', 'PF and ESI as per government rules'),
  ('Floor Supervisor', 'Run the showroom floor day to day so customers are served quickly and well.', 'Plan staff on the floor and counters for each shift
Help the sales team close sales and handle escalations
Check stock movement, displays and housekeeping
Report daily sales to the store manager', '2+ years of retail experience, with some team handling
Good communication in Tamil', 'PF and ESI as per government rules'),
  ('Store Manager', 'Lead the showroom team and own its sales, customer service and daily operations.', 'Plan and track monthly sales targets
Lead, train and schedule the store team
Control stock, cash and audit compliance
Handle key customers and complaints', '5+ years in retail, with at least 2 years managing a team or store
Good communication in Tamil and English', 'PF and ESI as per government rules'),
  ('Cashier', 'Handle billing, payments and the daily cash position of the showroom.', 'Prepare bills and collect cash, card and UPI payments
Balance the cash counter at the end of each day
Issue receipts and handle refunds or exchanges as per policy
Coordinate with accounts on daily collections', 'Basic computer knowledge; billing software experience is a plus
Accuracy with numbers and cash', 'PF and ESI as per government rules'),
  ('Executive Accounts', 'Keep the branch''s accounts accurate and up to date.', 'Record day-to-day entries, vouchers and bank reconciliations
Prepare GST and TDS working and support filings
Track receivables and payables
Support audits with documents and reports', 'B.Com or equivalent
Tally or similar accounting software; GST knowledge preferred', 'PF and ESI as per government rules'),
  ('Data Entry Operator', 'Enter and maintain the showroom''s records accurately in the computer system.', 'Enter sales, stock and customer data
Check entries for errors and fix mismatches
Prepare simple daily and monthly reports
Keep files and documents organised', 'Basic computer and typing skills (MS Excel preferred)
Freshers can apply', 'PF and ESI as per government rules'),
  ('Customer Care Executive', 'Be the customer''s first point of contact and make sure every query is answered.', 'Answer calls, WhatsApp messages and walk-in queries
Book appointments, deliveries and service follow-ups
Record complaints and follow them up until closed
Collect customer feedback', 'Good communication in Tamil; basic English
Freshers can apply', 'PF and ESI as per government rules'),
  ('Customer Care Manager', 'Lead customer service for the branch and keep customer satisfaction high.', 'Manage the customer care team and its daily work
Handle escalated complaints and find solutions
Track feedback and improve service processes
Report service quality to management', '3+ years in customer service, with team handling
Good communication in Tamil and English', 'PF and ESI as per government rules'),
  ('Receptionist', 'Welcome visitors at the front desk and keep the front office running smoothly.', 'Greet customers and visitors and guide them to the right team
Answer and transfer phone calls
Maintain visitor registers and appointments
Keep the reception area tidy', 'Pleasant manner and good communication in Tamil
Freshers can apply', 'PF and ESI as per government rules'),
  ('HR Executive', 'Support hiring, joining and employee records for the branches.', 'Source candidates and schedule interviews
Handle joining formalities and documents
Maintain attendance and employee records
Support PF and ESI processes', 'Graduate (MBA HR preferred)
Good communication in Tamil and English; MS Excel', 'PF and ESI as per government rules'),
  ('Digital Marketing', 'Promote our showrooms online and bring in enquiries.', 'Plan and post content on Instagram, Facebook and WhatsApp
Run and track paid ads within budget
Create simple graphics and short videos
Report enquiries and results every month', 'Hands-on social media and ads experience
Basic design tools (Canva or similar)', 'PF and ESI as per government rules'),
  ('Service Advisor', 'Receive vehicles for service and keep customers informed until delivery.', 'Receive vehicles, note the customer''s concerns and open job cards
Explain the work, cost estimate and delivery time
Coordinate with technicians and update customers
Explain the work done and the bill at delivery', 'Diploma, ITI or graduate; two-wheeler service experience preferred
Good communication in Tamil', 'PF and ESI as per government rules'),
  ('Manager Service', 'Run the workshop so vehicles are serviced right, on time and profitably.', 'Plan workshop work and technician allocation
Check service quality and turnaround time
Handle escalated customer complaints
Track workshop revenue, warranty claims and targets', '5+ years in automobile service, with team handling
Diploma or degree in automobile or mechanical engineering preferred', 'PF and ESI as per government rules'),
  ('Manager Spares', 'Manage the spare parts store so parts are available when needed.', 'Plan stock and place orders with the company and vendors
Control parts inventory, counter sales and billing
Handle warranty parts and returns
Run stock audits and reports', '3+ years in automobile spare parts
Computer knowledge for inventory software', 'PF and ESI as per government rules'),
  ('Technician', 'Service and repair two-wheelers in our workshop.', 'Carry out periodic service, repairs and inspections
Diagnose problems and replace parts
Follow company service standards and safety rules
Road-test vehicles after work', 'ITI or diploma (mechanical or automobile) preferred
Two-wheeler service experience preferred; freshers with an ITI can apply', 'PF and ESI as per government rules'),
  ('Assistant Technician', 'Help technicians service and repair two-wheelers, and learn on the job.', 'Assist with servicing, washing and part replacement
Keep tools and the work bay clean and ready
Learn diagnosis and repair from senior technicians', 'ITI or 10th pass; interest in vehicles
Freshers can apply', 'PF and ESI as per government rules'),
  ('Incharge PDI', 'Make sure every new vehicle is fully checked before it is delivered to the customer.', 'Carry out pre-delivery inspection (PDI) of new vehicles
Fix or report defects before delivery
Keep PDI records and checklists
Coordinate deliveries with the sales team', 'ITI or diploma in automobile or mechanical
Two-wheeler PDI or service experience', 'PF and ESI as per government rules'),
  ('Electrician', 'Look after electrical work on vehicles and the showroom.', 'Diagnose and repair vehicle wiring, lights and batteries
Install accessories
Maintain the showroom and workshop electricals', 'ITI (electrician or electrical)
Automobile electrical experience preferred', 'PF and ESI as per government rules'),
  ('Helper', 'Support the showroom or workshop team with day-to-day tasks.', 'Help with loading and unloading, moving stock and deliveries
Assist the team with daily work as directed
Keep work areas clean and orderly', 'No formal education needed
Freshers can apply', 'PF and ESI as per government rules'),
  ('House Keeping', 'Keep the showroom clean, fresh and welcoming for customers.', 'Clean the showroom, restrooms and staff areas every day
Dust displays and counters
Report repairs and refill supplies', 'No formal education needed
Freshers can apply', 'PF and ESI as per government rules')
on conflict (name) do nothing;

-- 1. Job openings ----------------------------------------------------------------------------------------------
create table if not exists job_openings (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references branches (id) on delete cascade,
  post        text not null,
  opened_at   timestamptz not null default now(),
  closes_on   date,                         -- last day the job is listed; null = no closing date
  salary_min  int check (salary_min is null or salary_min > 0),
  salary_max  int check (salary_max is null or salary_max > 0),
  closed_at   timestamptz,                  -- set when the post is unticked at the store
  updated_at  timestamptz not null default now(),
  check (salary_min is null or salary_max is null or salary_max >= salary_min)
);
create unique index if not exists job_openings_open on job_openings (branch_id, post) where closed_at is null;
alter table job_openings enable row level security;
drop policy if exists job_openings_read on job_openings;
create policy job_openings_read on job_openings for select to authenticated using (true);
-- Admin edits closing dates and salaries; rows are opened and closed only by the trigger below.
drop policy if exists job_openings_admin on job_openings;
create policy job_openings_admin on job_openings for update to authenticated using (is_admin()) with check (is_admin());

create or replace function job_openings_touch() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists job_openings_touch on job_openings;
create trigger job_openings_touch before update on job_openings for each row execute function job_openings_touch();

-- Opens a row for each newly ticked post (listed for 30 days unless admin changes it) and closes unticked ones.
create or replace function sync_job_openings() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update job_openings j set closed_at = now()
   where j.closed_at is null
     and not coalesce((new.value -> j.branch_id::text) ? j.post, false);
  insert into job_openings (branch_id, post, closes_on)
  select b.key::uuid, p.post, ((now() at time zone 'Asia/Kolkata')::date + 30)
    from jsonb_each(new.value) b
    cross join lateral jsonb_array_elements_text(case jsonb_typeof(b.value) when 'array' then b.value else '[]' end) p(post)
    join branches br on br.id::text = b.key
   where not exists (select 1 from job_openings j where j.branch_id::text = b.key and j.post = p.post and j.closed_at is null);
  return new;
end $$;
revoke all on function sync_job_openings() from public, anon, authenticated;
drop trigger if exists sync_job_openings on app_settings;
create trigger sync_job_openings after insert or update on app_settings
  for each row when (new.key = 'branch_posts') execute function sync_job_openings();

-- Backfill the posts open now. The posting date is when each post was last ticked, read from the change history
-- (24 Oct 2026, when history starts, for posts open since then).
with snaps as (
  select at, detail -> 'value' -> 'to' as v from audit_log where action = 'app_settings update' and target = 'branch_posts'
), first_at as (select coalesce(min(at), now()) as at from snaps),
pairs as (
  select b.key as bid, p.post
    from app_settings s, jsonb_each(s.value) b, jsonb_array_elements_text(b.value) p(post)
   where s.key = 'branch_posts' and jsonb_typeof(b.value) = 'array'
),
opened as (
  select x.bid, x.post,
         coalesce((select min(s.at) from snaps s
                    where (s.v -> x.bid) ? x.post
                      and s.at > coalesce((select max(s2.at) from snaps s2 where not coalesce((s2.v -> x.bid) ? x.post, false)), '-infinity')),
                  (select at from first_at)) as at
    from pairs x
)
insert into job_openings (branch_id, post, opened_at, closes_on)
select o.bid::uuid, o.post, o.at, ((o.at at time zone 'Asia/Kolkata')::date + 30)
  from opened o join branches br on br.id::text = o.bid
 where not exists (select 1 from job_openings j where j.branch_id::text = o.bid and j.post = o.post and j.closed_at is null);

-- 5. Public read -----------------------------------------------------------------------------------------------
create or replace function public_jobs() returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', j.id, 'post', j.post, 'opened_at', j.opened_at, 'closes_on', j.closes_on, 'updated_at', j.updated_at,
      'salary_min', j.salary_min, 'salary_max', j.salary_max,
      'branch', jsonb_build_object('id', b.id, 'name', b.name, 'town', b.town, 'division', b.division,
                                   'business_type', b.business_type, 'street_address', b.street_address, 'postal_code', b.postal_code),
      'role', (select jsonb_build_object('summary', r.summary, 'duties', r.duties, 'requirements', r.requirements,
                                         'shift', r.shift, 'benefits', r.benefits, 'updated_at', r.updated_at)
                 from job_roles r where r.name = j.post))
    order by b.town, b.name, j.post), '[]')
  from job_openings j join branches b on b.id = j.branch_id
  where j.closed_at is null
    and (j.closes_on is null or j.closes_on >= (now() at time zone 'Asia/Kolkata')::date)
$$;
revoke all on function public_jobs() from public;
grant execute on function public_jobs() to anon, authenticated;
