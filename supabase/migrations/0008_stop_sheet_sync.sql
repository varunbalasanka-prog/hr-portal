-- Applications now come in through /apply, so the 15-minute Google Sheet sync is switched off.
select cron.unschedule('sheet-sync');
