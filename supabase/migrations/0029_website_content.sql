-- balasanka.in content that varun edits himself (Website page in the HR portal, superadmin only):
-- showrooms, blog posts, and the words on the business, home, About, contact and food pages.
-- Anyone may read what is published; only the superadmin can change it. Safe to run more than once:
-- the starting content is only added when a table or key is still empty, so it never overwrites edits.

create or replace function site_touch() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

-- Showrooms ------------------------------------------------------------------------------------------
create table if not exists site_showrooms (
  id uuid primary key default gen_random_uuid(),
  business text not null check (business in ('vehicles', 'jewellery', 'watches')),
  brand text not null check (length(trim(brand)) between 1 and 80),
  town text not null check (length(trim(town)) between 1 and 60),
  company text not null default '' check (length(company) <= 120),
  street text not null check (length(trim(street)) between 1 and 200),
  pin text not null check (pin ~ '^[1-9][0-9]{5}$'),
  sort int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
drop trigger if exists touch on site_showrooms;
create trigger touch before insert or update on site_showrooms for each row execute function site_touch();

-- Blog posts -----------------------------------------------------------------------------------------
create table if not exists site_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 90),
  title text not null check (length(trim(title)) between 1 and 150),
  description text not null check (length(trim(description)) between 1 and 300),
  category text not null check (category in ('vehicles', 'jewellery', 'watches', 'story', 'careers')),
  body text not null default '' check (length(body) <= 60000),
  published_on date not null default current_date,
  checked_on date,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
drop trigger if exists touch on site_posts;
create trigger touch before insert or update on site_posts for each row execute function site_touch();

-- Words on the pages, one JSON value per part of the site -----------------------------------------
create table if not exists site_content (
  key text primary key check (key in ('businesses', 'brand_notes', 'brand_strip', 'home', 'about', 'contact', 'foods')),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
drop trigger if exists touch on site_content;
create trigger touch before insert or update on site_content for each row execute function site_touch();

-- Who can read and write -----------------------------------------------------------------------------
alter table site_showrooms enable row level security;
alter table site_posts enable row level security;
alter table site_content enable row level security;

grant select on site_showrooms, site_posts, site_content to anon, authenticated;
grant insert, update, delete on site_showrooms, site_posts, site_content to authenticated;

drop policy if exists site_showrooms_read on site_showrooms;
create policy site_showrooms_read on site_showrooms for select to anon, authenticated using (true);
drop policy if exists site_showrooms_edit on site_showrooms;
create policy site_showrooms_edit on site_showrooms for all to authenticated using (is_super_admin()) with check (is_super_admin());

-- Drafts and posts dated in the future stay hidden from visitors (Indian date).
drop policy if exists site_posts_read on site_posts;
create policy site_posts_read on site_posts for select to anon, authenticated
  using (status = 'published' and published_on <= (now() at time zone 'Asia/Kolkata')::date);
drop policy if exists site_posts_edit on site_posts;
create policy site_posts_edit on site_posts for all to authenticated using (is_super_admin()) with check (is_super_admin());

drop policy if exists site_content_read on site_content;
create policy site_content_read on site_content for select to anon, authenticated using (true);
drop policy if exists site_content_edit on site_content;
create policy site_content_edit on site_content for all to authenticated using (is_super_admin()) with check (is_super_admin());

-- Brand logos: a public bucket, pictures only (no SVG, which can carry scripts), up to 1 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site', 'site', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_files_edit on storage.objects;
create policy site_files_edit on storage.objects for all to authenticated
  using (bucket_id = 'site' and is_super_admin()) with check (bucket_id = 'site' and is_super_admin());

-- Starting content: today's site, copied from the code (written by scripts/site-seed-sql.ts) --------
insert into site_content (key, value)
select k, v::jsonb from (values
  ($s$businesses$s$, $s${"vehicles":{"title":"Two-wheelers and cycles","tamil":"இருசக்கர வாகனங்கள்","blurb":"TVS and Honda dealerships with sales, service and spares, and a cycle showroom in Theni."},"jewellery":{"title":"Jewellery","tamil":"நகைகள்","blurb":"Our own Akshaya Velli showrooms and its luxury line Zora, and Tanishq, Mia by Tanishq and CaratLane stores."},"watches":{"title":"Watches and eyewear","tamil":"கடிகாரங்கள், கண்ணாடிகள்","blurb":"Titan, Fastrack and Titan Eye+ stores for watches, accessories and eye care."}}$s$),
  ($s$brand_notes$s$, $s${"Akshaya Velli":"Our own jewellery house. Velli is the Tamil word for silver.","Zora":"Zora by Akshaya Velli, its more luxurious line: silver jewellery, silver gifts and pooja articles.","Tanishq":"Tanishq gold and diamond jewellery, a Titan Company brand, in a franchise showroom run by us.","Mia by Tanishq":"Light, everyday jewellery from Tanishq.","CaratLane":"Diamond and gold jewellery from CaratLane, a Titan Company brand.","Titan":"Titan watches, in a franchise store run by us.","Titan Eye+":"Spectacles, sunglasses and eye tests from Titan Eye+.","Fastrack":"Fastrack watches, bags and accessories.","Balasanka TVS":"TVS motorcycles and scooters, with service and genuine spares.","Shri Murugesan TVS":"TVS motorcycles and scooters, with service and genuine spares.","Yasotha Motors":"Two-wheeler sales and service in Theni.","Mukesh Honda":"Honda motorcycles and scooters, with service and genuine spares.","Balasanka Cycle Bazar":"Bicycles and cycle accessories."}$s$),
  ($s$brand_strip$s$, $s$[{"name":"TVS","note":"Authorised dealer"},{"name":"Honda","note":"Authorised dealer"},{"name":"Balasanka Cycle Bazar","note":"Our own store"},{"name":"Akshaya Velli","note":"Our own jewellery house"},{"name":"Zora","note":"Akshaya Velli's luxury line"},{"name":"Tanishq","note":"Franchise store"},{"name":"Mia by Tanishq","note":"Franchise store"},{"name":"CaratLane","note":"Franchise store"},{"name":"Titan","note":"Franchise store"},{"name":"Fastrack","note":"Franchise store"},{"name":"Titan Eye+","note":"Franchise store"},{"name":"Akshaya Dhal","note":"Our own brand"},{"name":"Balasanka Dhal","note":"Our own brand"},{"name":"Sanka Dhal","note":"Our own brand"},{"name":"SGT","note":"Our tamarind, since 1966"}]$s$),
  ($s$home$s$, $s${"intro":"Two-wheelers, jewellery, watches and eyewear at {showrooms} showrooms in {towns} towns of South Tamil Nadu, from Theni to Tirunelveli, and dhal and seedless tamarind from our factory in Theni. A Theni family business since 1966.","careers":"We hire for sales, service, accounts and customer care at our showrooms, and freshers are welcome. Apply online in about five minutes."}$s$),
  ($s$about$s$, $s${"intro":["Balasanka Group began in Theni in 1966 as a small tamarind processing unit. Sixty years later, the same family runs two-wheeler dealerships, jewellery houses and lifestyle stores across {town list}, and still makes dhal and seedless tamarind at its factory in Theni.","Our own brands are Akshaya Dhal, Balasanka Dhal, Sanka Dhal and SGT tamarind, and the jewellery house Akshaya Velli with its luxury line Zora. We run them alongside dealerships and franchise stores for TVS, Honda, Tanishq, Mia by Tanishq, CaratLane, Titan, Titan Eye+ and Fastrack."],"story":[{"year":"1966","title":"SGT","text":"Mr. S. Thirupathi Nadar starts SGT, a small tamarind business in Theni. Honest weight and fair grading become the family's way of doing business."},{"year":"1991","title":"Balasanka Dhal","text":"The family starts processing pulses, and sets up Asia's first solar dryer for pulses. Sanka Dhal follows in 1995 and Akshaya Dhal in 2016."},{"year":"1997","title":"Shri Murugesan Motors","text":"Our first two-wheeler dealership opens in Theni."},{"year":"2001","title":"Sri Balasanka Mills","text":"A mill in Theni turned tamarind seeds, once thrown away, into starch for textile printing and husk for fuel."},{"year":"2004–2017","title":"Two-wheelers across the south","text":"Balasanka TVS, Mukesh Motors (Honda), Yasotha Motors and Tenkasi TVS take our dealerships to six towns."},{"year":"2019","title":"Tanishq","text":"Our first jewellery store, Tanishq, opens in Theni. Titan, Titan Eye+, Mia and CaratLane stores follow."},{"year":"2021","title":"Akshaya Velli","text":"Our own silver jewellery house opens in Theni, then in Tenkasi, Tirunelveli and Sivakasi."},{"year":"2025","title":"Zora","text":"Zora by Akshaya Velli, its more luxurious line, opens in Theni for silver jewellery, silver gifts and pooja articles."}],"values":[{"title":"Purity you can check","text":"Hallmarked silver and gold, graded produce and genuine spares. What we sell is what the label says."},{"title":"A family business","text":"The same family has run the group for three generations, and the people you meet in our showrooms are from your town."},{"title":"Close to home","text":"Every showroom is in South Tamil Nadu, within a few hours of Theni, where the group began."}]}$s$),
  ($s$contact$s$, $s${"email":"support@balasanka.in","write":"For questions about the group, our companies or working with us as a brand partner.","visit":"For a purchase, an order or a service booking, the showroom near you can help directly.","jobs":"Every open job at our showrooms, with an online application that takes about five minutes."}$s$),
  ($s$foods$s$, $s${"title":"Dhal and tamarind","tamil":"பருப்பு, புளி","blurb":"Toor, urad and moong dhal and seedless tamarind from our factory in Theni, for shops, traders and families.","products":["Toor dhal","Urad dhal","Moong dhal","Seedless tamarind"],"brands":[{"name":"SGT","note":"Tamarind, since 1966. Where the group began."},{"name":"Balasanka Dhal","note":"Since 1991."},{"name":"Sanka Dhal","note":"Since 1995."},{"name":"Akshaya Dhal","note":"Since 2016."}]}$s$)
) as t(k, v)
on conflict (key) do nothing;

insert into site_showrooms (business, brand, town, company, street, pin, sort)
select * from (values
  ($s$vehicles$s$, $s$Balasanka TVS$s$, $s$Sivakasi$s$, $s$Balasanka Motor Private Ltd$s$, $s$No 441 Virudhunagar Road$s$, $s$626123$s$, 10),
  ($s$vehicles$s$, $s$Balasanka TVS$s$, $s$Virudhunagar$s$, $s$Balasanka Motor Private Ltd$s$, $s$97/2 Katcheri Road$s$, $s$626001$s$, 20),
  ($s$vehicles$s$, $s$Balasanka TVS$s$, $s$Tenkasi$s$, $s$Balasanka Automobiles LLP$s$, $s$No 18 Housing Board Colony, Madurai Road$s$, $s$627811$s$, 30),
  ($s$vehicles$s$, $s$Shri Murugesan TVS$s$, $s$Theni$s$, $s$Shri Murugesan Motor LLP$s$, $s$W8/158 Rathinam Nagar, Periyakulam Road$s$, $s$625531$s$, 40),
  ($s$vehicles$s$, $s$Yasotha Motors$s$, $s$Theni$s$, $s$Yasotha Motors$s$, $s$336/2 Periyakulam Road, Unjampatti$s$, $s$625531$s$, 50),
  ($s$vehicles$s$, $s$Mukesh Honda$s$, $s$Rajapalayam$s$, $s$Mukesh Motor$s$, $s$1064/A Tenkasi Road, Near Cotton Market$s$, $s$626117$s$, 60),
  ($s$vehicles$s$, $s$Mukesh Honda$s$, $s$Sivakasi$s$, $s$Mukesh Motor$s$, $s$462/1 Virudhunagar Road, Thiruthangal$s$, $s$626130$s$, 70),
  ($s$vehicles$s$, $s$Mukesh Honda$s$, $s$Srivilliputhur$s$, $s$Mukesh Motor$s$, $s$61/2 61/3 61/4 Madurai Main Road, Ramakrishnapuram$s$, $s$626135$s$, 80),
  ($s$vehicles$s$, $s$Balasanka Cycle Bazar$s$, $s$Theni$s$, $s$Balasanka Cycle Bazar$s$, $s$No 339 Rathnam Nagar, Periyakulam Road$s$, $s$625531$s$, 90),
  ($s$jewellery$s$, $s$Akshaya Velli$s$, $s$Theni$s$, $s$Balasanka Akshaya Velli LLP$s$, $s$No 441/2A Balasanka Plaza, Periyakulam Road$s$, $s$625531$s$, 100),
  ($s$jewellery$s$, $s$Akshaya Velli$s$, $s$Rajapalayam$s$, $s$Balasanka Akshaya Velli LLP$s$, $s$Madurai Road, Cotton Market$s$, $s$626117$s$, 110),
  ($s$jewellery$s$, $s$Akshaya Velli$s$, $s$Sivakasi$s$, $s$Balasanka Akshaya Velli LLP$s$, $s$200 B Tiruthangal Road$s$, $s$626123$s$, 120),
  ($s$jewellery$s$, $s$Akshaya Velli$s$, $s$Tenkasi$s$, $s$Balasanka Akshaya Velli LLP$s$, $s$No 154/42/20 Railway Road$s$, $s$627811$s$, 130),
  ($s$jewellery$s$, $s$Akshaya Velli$s$, $s$Tirunelveli$s$, $s$Balasanka Akshaya Velli LLP$s$, $s$167 Trivandrum Road, Murugankuruchi, Palayamkottai$s$, $s$627002$s$, 140),
  ($s$jewellery$s$, $s$Zora$s$, $s$Theni$s$, $s$Balasanka Akshaya Velli LLP$s$, $s$1396 Nehruji Road, Periyakulam Main Road$s$, $s$625531$s$, 150),
  ($s$jewellery$s$, $s$Tanishq$s$, $s$Theni$s$, $s$Balasanka Jewellery LLP$s$, $s$No 554/3 And 1693/2C Periyakulam Road$s$, $s$625531$s$, 160),
  ($s$jewellery$s$, $s$Mia by Tanishq$s$, $s$Madurai$s$, $s$Balasanka Jewellery LLP$s$, $s$11 Anna Salai 80 ft Road, Bye Pass Main Road, KK Nagar$s$, $s$625020$s$, 170),
  ($s$jewellery$s$, $s$CaratLane$s$, $s$Theni$s$, $s$Balasanka Jewellery LLP$s$, $s$No 1539/2 Nehruji Road, Periyakulam Main Road, opposite Municipal Office$s$, $s$625531$s$, 180),
  ($s$jewellery$s$, $s$CaratLane$s$, $s$Sivakasi$s$, $s$Balasanka Jewellery LLP$s$, $s$200 A Thiruthangal Main Road$s$, $s$626123$s$, 190),
  ($s$jewellery$s$, $s$CaratLane$s$, $s$Tirunelveli$s$, $s$Balasanka Jewellery LLP$s$, $s$166 Trivandrum Road, Palayamkottai, Murugankuruchi$s$, $s$627002$s$, 200),
  ($s$watches$s$, $s$Titan$s$, $s$Tenkasi$s$, $s$Balasanka Jewellery LLP$s$, $s$154/21 Railway Road$s$, $s$627811$s$, 210),
  ($s$watches$s$, $s$Titan Eye+$s$, $s$Tenkasi$s$, $s$Balasanka Jewellery LLP$s$, $s$154/21 Railway Road$s$, $s$627811$s$, 220),
  ($s$watches$s$, $s$Fastrack$s$, $s$Madurai$s$, $s$Balasanka Jewellery LLP$s$, $s$11 Anna Salai 80 ft Road, Bye Pass Main Road, KK Nagar$s$, $s$625020$s$, 230)
) as t(business, brand, town, company, street, pin, sort)
where not exists (select 1 from site_showrooms);

insert into site_posts (slug, title, description, category, body, published_on, checked_on, status)
select slug, title, description, category, body, published_on::date, checked_on::date, 'published' from (values
  ($s$balasanka-story-from-theni-1966$s$, $s$From a tamarind business in Theni to 23 showrooms$s$, $s$How the Balasanka Group grew from a small tamarind business started in Theni in 1966, which still runs today, into two-wheeler, jewellery and watch showrooms across South Tamil Nadu.$s$, $s$story$s$, $s$Most of our customers know us by a showroom name: a TVS or Honda dealership, Akshaya Velli, Tanishq or Titan. Fewer know that all of them grew from one small tamarind business in Theni, started nearly sixty years ago, and that the business is still running today.

## 1966: SGT, Theni

In 1966, Mr. S. Thirupathi Nadar started SGT, a small tamarind business in Theni. It was a trade where customers judged a seller by the weight on the scale and the grade of the produce. Honest weight and fair grading became the family's way of doing business, and they still are.

## From tamarind to pulses

In 1991 the family started Balasanka Dhal, processing pulses, and set up what was then Asia's first solar dryer for pulses. Sanka Dhal followed in 1995 and Akshaya Dhal in 2016. From 2001, Sri Balasanka Mills turned tamarind seeds, which used to be thrown away, into starch for textile printing and husk for fuel. The mill has since closed.

The food business itself never stopped. SGT, Balasanka Dhal, Sanka Dhal and Akshaya Dhal still make seedless tamarind and toor, urad and moong dhal at our factory in Theni, sold wholesale and at the factory outlet there.

## Two-wheelers

Our first two-wheeler dealership, Shri Murugesan Motors, opened in Theni in 1997. Between 2004 and 2017, Balasanka TVS, Mukesh Motors (Honda), Yasotha Motors and the Tenkasi TVS dealership took our two-wheeler business to six towns. Today it is the largest part of the group, with sales, service and genuine spares in every showroom.

## Jewellery, watches and eyewear

In 2019 our first jewellery store, Tanishq, opened in Theni. Titan, Titan Eye+, Mia by Tanishq and CaratLane stores followed. In 2021 we opened Akshaya Velli in Theni, our own silver jewellery house, and then took it to Tenkasi, Tirunelveli and Sivakasi. In 2025, Zora by Akshaya Velli, its more luxurious line, opened in Theni for silver jewellery, silver gifts and pooja articles.

## Today

Alongside the food business in Theni, the group now runs 23 showrooms in Madurai, Rajapalayam, Sivakasi, Srivilliputhur, Tenkasi, Theni, Tirunelveli and Virudhunagar. The businesses are very different, but the idea from 1966 hasn't changed: what we sell should be exactly what the label says.

You can read more on our [About page](/about), or [find a showroom near you](/showrooms).$s$, $s$2026-11-03$s$, $s$2026-11-03$s$),
  ($s$how-often-should-you-get-your-eyes-tested$s$, $s$How often should you get your eyes tested?$s$, $s$A simple guide for adults and children, the signs that mean you or your child may need glasses, and when to see an eye doctor straight away.$s$, $s$watches$s$, $s$Many people only get their eyes tested when they can no longer read a phone or a bus number. By then, they have often been straining for months, with headaches and tired eyes they blamed on something else. A short eye test at the right time saves a lot of that.

## A rough guide by age

This is general guidance. Your eye doctor may ask you to come more often.

- **Children:** before they start school, and then once a year. Children rarely complain about poor eyesight because they think everyone sees the way they do.
- **Adults up to 40:** every two years if you have no problems.
- **After 40:** every one to two years. Most people start finding it hard to read small print up close around this age. It is natural and easy to correct.
- **After 60, or if you have diabetes or high blood pressure:** once a year, including a check by an eye doctor for problems inside the eye.

## Signs your child may need glasses

- Sitting very close to the TV or holding books near the face.
- Squinting, tilting the head or covering one eye to see.
- Rubbing the eyes often or complaining of headaches after school.
- Losing their place while reading, or marks dropping without a clear reason.
- Copying wrongly from the blackboard.

## Signs you may need glasses or a new power

- Holding your phone further away to read it.
- Headaches after reading, screen work or driving.
- Difficulty seeing road signs, especially at night.
- Your current glasses feel "not right" any more.

## See an eye doctor straight away if you have

- Sudden loss of vision, even for a short while.
- Sudden flashes of light or a shower of floating spots.
- Eye pain, or a red eye that is painful.
- Double vision that comes on suddenly.

These are not things glasses can fix. Go to an eye hospital or an ophthalmologist the same day.

> An eye test at an optical store checks your eyesight for glasses. It does not replace a full check by an eye doctor for eye diseases.

## Getting your eyes tested with us

Our Titan Eye+ store in Tenkasi does eye tests for glasses. Bring your old glasses, if you have them, so the optometrist can compare your current power with the new one.$s$, $s$2026-11-03$s$, null),
  ($s$how-to-check-gold-and-silver-hallmark$s$, $s$How to check the hallmark on gold and silver jewellery$s$, $s$What the three marks on hallmarked jewellery mean, what 22K916 and 925 stand for, and how to check a HUID number on your phone in under a minute.$s$, $s$jewellery$s$, $s$A hallmark is the government's guarantee that a piece of jewellery is as pure as the shop says. In India, hallmarking is done by centres approved by the Bureau of Indian Standards (BIS), not by the jeweller. So when you know how to read it, you don't have to take anyone's word for it, including ours.

## The three marks on gold

Look closely at the inside of a ring, the hook of an earring or the clasp of a chain. Hallmarked gold jewellery carries three marks:

1. **The BIS logo**, a small triangle-shaped mark.
2. **The purity**, written as carat and fineness together, for example **22K916**.
3. **The HUID**, a six-character code of letters and numbers, unique to that one piece.

The marks are tiny. Ask the showroom for a magnifying glass; every good jeweller keeps one at the counter.

## What 22K916 means

The number after the K tells you how many parts out of 1,000 are pure gold.

- **22K916**: 91.6% gold. Most traditional Tamil Nadu jewellery, such as chains, bangles and thali, is 22 carat.
- **18K750**: 75% gold. Common in diamond and studded jewellery, because the harder metal holds stones better.
- **14K585**: 58.5% gold. Used for light, everyday pieces.

Lower carat is not "fake" gold. It is a different, harder mix, and it should be priced for the gold it actually contains.

## Check the HUID on your phone

Since 1 April 2023, hallmarked gold jewellery in India carries a HUID instead of the older jeweller's mark. You can check any HUID yourself:

1. Install the free **BIS CARE** app from the Play Store or App Store.
2. Open **Verify HUID** and type the six characters exactly as marked.
3. The app shows the type of article, its purity, the registered jeweller and the hallmarking centre that tested it.

If what the app shows doesn't match the piece in your hand, for example it says "ring" and you are holding a chain, ask the jeweller to explain before you pay.

## Silver hallmarks

Silver can be hallmarked too. The most common grade is **925**, meaning 92.5% pure silver, often called sterling silver. Hallmarking is not compulsory for silver the way it is for most gold jewellery, so it is worth asking whether a silver piece is hallmarked and what grade it is.

> At Akshaya Velli and its luxury line Zora, our silver is sold hallmarked. If you can't find the mark on a piece, ask any of our staff to show it to you.

## Before you pay

- Check that the purity on the hallmark matches the purity written on your bill.
- Make sure the bill lists the weight, purity and HUID of each item.
- Keep the bill. You will need it if you exchange or sell the piece later.$s$, $s$2026-11-03$s$, null),
  ($s$preparing-for-a-showroom-job-interview$s$, $s$How to prepare for a job interview at a Balasanka showroom$s$, $s$What happens after you apply for a job at our showrooms, what to bring to the interview, and the simple things that make a good first impression.$s$, $s$careers$s$, $s$Every year we hire hundreds of people across our two-wheeler, jewellery and watch showrooms: sales staff, service technicians, cashiers, accountants and more. Many of them are starting their first job. If that's you, this guide explains what to expect.

## How it works

1. **Apply online.** Go to our [careers page](https://hr.balasanka.in/careers), choose the showroom and job, and fill in the form. It takes about five minutes and is in English and Tamil. You must be 18 or older.
2. **We call you.** Our HR team calls you to talk about the job and fix a time for the interview.
3. **Interview at the showroom.** Every candidate is interviewed, including people who walk into a showroom to ask about work.
4. **Offer.** If you are selected, we send an offer and ask for your documents before you join.

## What to bring

- Your **Aadhaar card** and a copy.
- **Certificates** for your highest education and any courses, with copies.
- **Experience or relieving letters** from earlier jobs, if you have worked before.
- A **pen**, and your phone with enough charge in case we need to share details.

If you are unsure about anything, ask on the call. We would much rather you ask than worry.

## Making a good impression

- **Arrive ten minutes early.** If you are going to be late, call and tell us.
- **Dress neatly.** Clean, ironed, simple clothes are perfect. You don't need anything expensive.
- **Know the showroom.** Visit it or look it up on our [showrooms page](https://balasanka.in/showrooms) beforehand, and know which brands it sells.
- **Speak simply and honestly.** It's fine to answer in Tamil. If you don't know something, say so.
- **Show you like helping people.** In a showroom, how you treat a customer matters as much as what you know about the product. Think of a time you helped someone and be ready to talk about it.

## Questions you may be asked

- Tell us about yourself and your family.
- Why do you want to work in this showroom?
- What did you do in your last job, or in college?
- How would you handle a customer who is angry or confused?
- Are you able to work on weekends and during festival season? Showrooms are busiest then.

## Questions you can ask us

- What does a normal working day look like?
- What training will I get?
- How do people grow in this role?

Asking a good question shows you are serious about the job.

[See all open jobs](https://hr.balasanka.in/careers)$s$, $s$2026-11-03$s$, null),
  ($s$silver-jewellery-care-at-home$s$, $s$Looking after silver jewellery and pooja items at home$s$, $s$Why silver turns dark, how to clean it safely with things already in your kitchen, and how to store it so it stays bright through the humid months.$s$, $s$jewellery$s$, $s$Silver turning dark is not a sign that it is impure. Pure and sterling silver both react with sulphur in the air, and a thin dark layer called tarnish forms on the surface. Humid weather, sweat, perfume and some foods speed it up. The good news: tarnish sits only on the surface, and with a little care you can stop most of it from forming.

## Everyday habits that help

- **Put silver on last and take it off first.** Wear anklets, chains and rings after applying perfume, hair oil or lotion, not before.
- **Take it off before bathing or swimming.** Soap, chlorine and sea water all dull silver.
- **Wipe it after wearing.** A quick wipe with a soft, dry cotton cloth removes sweat before it does any harm.
- **Wear it often.** Silver worn regularly tarnishes less than silver locked away for months.

## Cleaning at home

For light dullness, this is enough:

1. Mix a few drops of mild dishwashing liquid in a bowl of warm water.
2. Soak the piece for a few minutes.
3. Clean gently with a soft toothbrush, especially in the design work.
4. Rinse in clean water and dry completely with a soft cloth. Don't leave it to air-dry.

Avoid toothpaste, ash, tamarind or scrubbing powders. They do remove tarnish, but they also scratch the surface and wear away fine design work over time.

> Some silver jewellery is darkened on purpose to bring out the design. This is called oxidised finish. Don't try to clean it bright; just wipe it with a dry cloth.

## Pooja items

Lamps, plates and kumkum boxes get oil, ghee and turmeric on them every day. Wash them in warm soapy water soon after use, before the oil hardens, then dry them fully. A soft cloth is better than a steel scrubber, which leaves fine scratches that tarnish faster.

## Storing silver

- Keep each piece in its own small zip-lock bag or soft cloth pouch, with as much air pressed out as possible.
- Store it in a dry cupboard, away from the bathroom and kitchen.
- A piece of chalk or a silica gel packet in the box soaks up moisture.
- Don't store silver with rubber bands or in newspaper. Both contain sulphur and darken silver quickly.

## When to bring it to us

Deep tarnish, broken clasps, loose stones or worn-out anklet bells are best left to a jeweller. Bring the piece and your bill to any Akshaya Velli showroom and our staff can tell you what can be done.$s$, $s$2026-11-03$s$, null),
  ($s$two-wheeler-loan-documents$s$, $s$Documents you need to buy a two-wheeler on a loan$s$, $s$A simple checklist of the papers most lenders ask for when you buy a scooter or motorcycle on EMI, for salaried people, business owners and farmers.$s$, $s$vehicles$s$, $s$Most people who buy a scooter or motorcycle at our showrooms pay for it in monthly instalments (EMI). The loan itself usually comes from a bank or finance company, not from the showroom, and each lender has its own rules. But the papers they ask for are almost always the same. Bring these on your first visit and the loan can often be approved the same day.

## For everyone

- **Aadhaar card**, for identity and address.
- **PAN card.**
- **Two recent passport-size photos.**
- **Your bank account details and a cancelled cheque.** The EMI is collected from this account every month.
- **Your mobile number linked to Aadhaar**, for the OTP during e-signing.

If your current address is different from the one on Aadhaar, also bring a recent electricity bill, gas bill or rental agreement in your name.

## Proof of income

This depends on how you earn:

- **Salaried:** your last three months' salary slips and six months of bank statements for the account your salary comes into.
- **Business owner or self-employed:** your latest income tax return and six months of bank statements.
- **Farmer:** land documents (patta or chitta) and bank statements, if you have them.

Some lenders offer loans with fewer income papers if your credit history is good or you pay a bigger down payment. Our finance desk can tell you which lenders suit your situation.

## Money you pay at the showroom

The loan rarely covers the full on-road price. Be ready for:

- **The down payment**, the part of the price the loan does not cover.
- **Processing fees**, if the lender charges them.
- **The first EMI or advance EMI**, for some lenders.

Ask for every charge in writing before you sign, so the total is clear.

## Things the showroom handles for you

You don't need to visit the RTO yourself. The showroom registers the vehicle, arranges the number plate and sets up insurance, which is compulsory by law. You will need a valid driving licence to ride the vehicle, so if you don't have one yet, apply early.

> The exact list can change from lender to lender. Call your nearest showroom before you visit and ask what to bring for the loan you are interested in.

## Before you sign

- Check the interest rate, number of EMIs and the EMI amount on the loan agreement.
- Ask whether there is a charge for closing the loan early.
- Keep copies of everything you sign.$s$, $s$2026-11-03$s$, null)
) as t(slug, title, description, category, body, published_on, checked_on)
where not exists (select 1 from site_posts)
on conflict (slug) do nothing;
