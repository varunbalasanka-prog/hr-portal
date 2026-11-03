-- Blog posts can be filed under "Dhal and tamarind" (category key 'foods'). Safe to run more than once.
alter table site_posts drop constraint if exists site_posts_category_check;
alter table site_posts add constraint site_posts_category_check
  check (category in ('vehicles', 'jewellery', 'watches', 'foods', 'story', 'careers'));
