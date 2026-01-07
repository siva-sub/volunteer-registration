-- Enable the pg_cron extension (Run this in Supabase SQL Editor)
-- Note: You may need to enable 'pg_cron' in Dashboard > Database > Extensions first.

create extension if not exists pg_cron;

-- Schedule the reminder job to run every day at 00:00 UTC (8:00 AM SGT)
-- REPLACE 'YOUR_SERVICE_ROLE_KEY' with your actual service role key from Project Settings > API
-- (Keep this key secret!)

select cron.schedule(
  'send-reminders-daily',
  '0 0 * * *', 
  $$
  select
    net.http_post(
      url:='https://zpqnoxllhbyggyxvvpaa.supabase.co/functions/v1/send-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body:='{"password": "temple2026"}'::jsonb
    ) as request_id;
  $$
);

-- To view scheduled jobs:
-- select * from cron.job;

-- To unschedule:
-- select cron.unschedule('send-reminders-daily');
