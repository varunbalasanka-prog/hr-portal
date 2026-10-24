-- Vercel's free plan only allows daily cron jobs, so the database calls the Sheet sync itself
-- every 15 minutes. Before running this, store the endpoint secret once (not in git):
--   select vault.create_secret('<CRON_SECRET from Vercel>', 'cron_secret');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('sheet-sync', '*/15 * * * *', $$
  select net.http_get(
    url := 'https://hr.balasanka.in/api/sync-sheet',
    headers := jsonb_build_object('Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    timeout_milliseconds := 60000)
$$);
