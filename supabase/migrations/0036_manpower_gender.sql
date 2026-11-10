-- 0036: stores say whether they want male, female or any staff on a manpower request.
-- One choice per request (a mixed need is sent as two requests). Old requests become 'any', so nothing collected before changes meaning.
-- Safe to run twice.
alter table manpower_requests add column if not exists gender text not null default 'any';
alter table manpower_requests drop constraint if exists manpower_gender_check;
alter table manpower_requests add constraint manpower_gender_check check (gender in ('any', 'male', 'female'));
