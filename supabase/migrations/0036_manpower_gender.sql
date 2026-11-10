-- 0036: stores say how many men and women they need on a manpower request (e.g. 2 male + 1 female + 1 any).
-- men + women can be less than headcount; the rest is "Any". Old requests get 0 + 0, so they read as all Any
-- and nothing collected before changes meaning. Works for permanent and temporary requests (headcount is the total).
-- Safe to run twice.
alter table manpower_requests add column if not exists men   int not null default 0;
alter table manpower_requests add column if not exists women int not null default 0;
alter table manpower_requests drop constraint if exists manpower_gender_split;
alter table manpower_requests add constraint manpower_gender_split check (men >= 0 and women >= 0 and men + women <= headcount);
