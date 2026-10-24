-- Balasanka HR Portal v2: initial schema
-- Replaces the Google Sheet tabs (Master Sheet, Walkin_Sheet, Documents_Sheet),
-- users_data.json, notifications_data.json and "All Showroom Details.xlsx".

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_role as enum ('admin', 'hr', 'branch');
create type candidate_source as enum ('online', 'walkin');
create type onboarding_status as enum ('submitted', 'pending', 'completed');

-- ---------------------------------------------------------------------------
-- Branches (was All Showroom Details.xlsx)
-- ---------------------------------------------------------------------------
create table branches (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,          -- e.g. "Tanishq - Theni"
  town          text not null,                 -- e.g. "Theni"
  address       text,                          -- full company name & address for letters
  business_type text not null default 'Jewellery',
  hr_username   text not null,                 -- owning HR executive
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (was users_data.json; passwords now live hashed in auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique,
  full_name  text not null,
  role       user_role not null,
  branch_id  uuid references branches (id) on delete set null,
  mobile     text,
  photo_path text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Candidates (was Master Sheet + Walkin_Sheet)
-- ---------------------------------------------------------------------------
create table candidates (
  id                     uuid primary key default gen_random_uuid(),
  source                 candidate_source not null,
  name                   text not null,
  mobile                 text not null unique,
  marital_status         text,
  father_name            text,
  email                  text,
  address                text,
  posts                  text[] not null default '{}',  -- posts applied for
  applied_locations      text[] not null default '{}',  -- branches applied for
  branch_id              uuid references branches (id) on delete set null, -- allocated branch
  assigned_hr            text not null,                 -- HR username
  entry_by               text,                          -- who created the record
  received_at            timestamptz not null default now(),

  pipeline_status        text not null default 'Follow-up Not Started',
  next_action            text,
  next_action_at         timestamptz,                   -- drives "Today's Work" and reminders

  -- Stage 1: screening calls
  calling_status         text,
  calling_action         text,
  first_call_at          timestamptz,
  first_retry_status     text,
  first_retry_at         timestamptz,
  second_retry_status    text,
  second_retry_at        timestamptz,
  third_retry_status     text,
  third_retry_at         timestamptz,

  -- Stage 2: interview
  interview_at           timestamptz,
  interview_attendance   text,
  interview_status       text,
  not_attended_reason    text,
  reschedule_at          timestamptz,
  reschedule_attendance  text,
  reminder_status        text,
  reminder_at            timestamptz,

  -- Stage 3: selection & joining
  designation            text,
  basic_salary           numeric(12,2) not null default 0,
  allowances             numeric(12,2) not null default 0,
  expected_joining_date  date,
  joining_status         text,
  not_joined_reason      text,
  revised_joining_date   date,
  revised_joining_status text,
  actual_joining_date    date,

  -- Exit
  employment_status      text,
  left_type              text,                          -- 'With Information' | 'Without Information'
  relieving_date         date,

  rejection_reason       text,
  interview_needed       boolean,                       -- walk-ins only
  form_data              jsonb not null default '{}',   -- raw application form answers
  access_token           uuid not null unique default gen_random_uuid(), -- for candidate links (letters, onboarding)
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index candidates_assigned_hr_idx on candidates (assigned_hr);
create index candidates_branch_idx on candidates (branch_id);
create index candidates_status_idx on candidates (pipeline_status);
create index candidates_next_action_at_idx on candidates (next_action_at);

-- Every update and remark (was the comma-joined "Remarks" cell)
create table candidate_events (
  id           bigint generated always as identity primary key,
  candidate_id uuid not null references candidates (id) on delete cascade,
  actor        text not null,
  stage        text not null,
  from_status  text,
  to_status    text,
  details      jsonb not null default '{}',
  remark       text,
  created_at   timestamptz not null default now()
);
create index candidate_events_candidate_idx on candidate_events (candidate_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Onboarding (was Documents_Sheet; files move from public Drive links to a private bucket)
-- ---------------------------------------------------------------------------
create table onboarding_submissions (
  id             uuid primary key default gen_random_uuid(),
  candidate_id   uuid not null unique references candidates (id) on delete cascade,
  status         onboarding_status not null default 'submitted',
  missing_docs   text[] not null default '{}',
  details        jsonb not null default '{}',  -- blood group, emergency contact, family, ESI/UAN...
  files          jsonb not null default '{}',  -- doc key -> storage path
  employee_code  text,
  shift_time     text,
  submitted_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notifications (was notifications_data.json)
-- ---------------------------------------------------------------------------
create table notifications (
  id         bigint generated always as identity primary key,
  sender     text not null,
  recipient  text not null,          -- username (HR, branch account or admin)
  message    text not null,
  file_path  text,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on notifications (recipient, created_at desc);

create table notification_receipts (
  notification_id bigint not null references notifications (id) on delete cascade,
  username        text not null,
  viewed_at       timestamptz,
  cleared_at      timestamptz,
  primary key (notification_id, username)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger candidates_touch before update on candidates
  for each row execute function touch_updated_at();
create trigger onboarding_touch before update on onboarding_submissions
  for each row execute function touch_updated_at();

create or replace function me() returns profiles
  language sql stable security definer set search_path = public as $$
  select * from profiles where id = auth.uid()
$$;

create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false)
$$;

-- Same rule as the old app: rejected as Not Suitable / Age Criteria, screening rejected,
-- or left without information => cannot re-apply or be reactivated.
create or replace function is_blacklisted(c candidates) returns boolean
  language sql immutable as $$
  select coalesce(c.rejection_reason, '') ilike any (array['%Not Suitable%', '%Age Criteria%'])
      or c.pipeline_status like 'Screening Rejected%'
      or (c.pipeline_status like 'Left%' and c.pipeline_status like '%Without Information%')
$$;

-- Who may see a candidate (mirrors get_sheet_data filtering)
create or replace function can_see_candidate(c candidates) returns boolean
  language sql stable security definer set search_path = public as $$
  select case p.role
    when 'admin' then true
    when 'hr' then c.assigned_hr = p.username
    when 'branch' then (c.branch_id = p.branch_id
        or exists (select 1 from branches b where b.id = p.branch_id and b.name = any (c.applied_locations)))
      and (c.source = 'walkin' or c.pipeline_status <> 'Follow-up Not Started')
    else false end
  from profiles p where p.id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table branches enable row level security;
alter table profiles enable row level security;
alter table candidates enable row level security;
alter table candidate_events enable row level security;
alter table onboarding_submissions enable row level security;
alter table notifications enable row level security;
alter table notification_receipts enable row level security;

create policy branches_read on branches for select to authenticated using (true);
create policy branches_admin on branches for all to authenticated using (is_admin()) with check (is_admin());

create policy profiles_read on profiles for select to authenticated using (true);
create policy profiles_self_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
create policy profiles_admin on profiles for all to authenticated using (is_admin()) with check (is_admin());

create policy candidates_read on candidates for select to authenticated using (can_see_candidate(candidates));
create policy candidates_insert on candidates for insert to authenticated with check (true);
create policy candidates_update on candidates for update to authenticated
  using (can_see_candidate(candidates)) with check (true);
create policy candidates_admin_delete on candidates for delete to authenticated using (is_admin());

create policy events_read on candidate_events for select to authenticated
  using (exists (select 1 from candidates c where c.id = candidate_id and can_see_candidate(c)));
create policy events_insert on candidate_events for insert to authenticated
  with check (exists (select 1 from candidates c where c.id = candidate_id and can_see_candidate(c)));

create policy onboarding_read on onboarding_submissions for select to authenticated
  using (exists (select 1 from candidates c where c.id = candidate_id and can_see_candidate(c)));
create policy onboarding_update on onboarding_submissions for update to authenticated
  using (exists (select 1 from candidates c where c.id = candidate_id and can_see_candidate(c)));
-- Inserts come from the public onboarding form through the server (service role).

create policy notifications_read on notifications for select to authenticated
  using (is_admin() or recipient = (me()).username or sender = (me()).username);
create policy notifications_insert on notifications for insert to authenticated
  with check (sender = (me()).username);
create policy notifications_admin_delete on notifications for delete to authenticated using (is_admin());

create policy receipts_own on notification_receipts for all to authenticated
  using (username = (me()).username or is_admin()) with check (username = (me()).username);

-- ---------------------------------------------------------------------------
-- Storage: private buckets (no "anyone with the link" sharing)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('onboarding-docs', 'onboarding-docs', false, 10485760),
       ('notification-files', 'notification-files', false, 10485760),
       ('avatars', 'avatars', false, 2097152)
on conflict (id) do nothing;

create policy notif_files_rw on storage.objects for all to authenticated
  using (bucket_id in ('notification-files', 'avatars'))
  with check (bucket_id in ('notification-files', 'avatars'));
-- onboarding-docs is only touched by the server with the service role and handed out as short-lived signed URLs.

-- Duplicate / blacklist lookup across ALL candidates (staff can only see their own via RLS,
-- but must not be able to re-add a blacklisted mobile at another branch).
create or replace function candidate_by_mobile(p_mobile text) returns setof candidates
  language sql stable security definer set search_path = public as $$
  select * from candidates where mobile = p_mobile and auth.uid() is not null limit 1
$$;
revoke all on function candidate_by_mobile(text) from public, anon;
grant execute on function candidate_by_mobile(text) to authenticated;
