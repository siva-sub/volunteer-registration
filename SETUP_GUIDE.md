# System Setup Guide

## 1. GitHub Deployment (Completed)
Your project has been deployed to GitHub Pages!
- **Repository:** https://github.com/siva-sub/volunteer-registration
- **Live Site:** https://siva-sub.github.io/volunteer-registration/ (May take a few minutes to appear)

## 2. Confirmation Emails
Confirmation emails are **already configured** in the code.
- When a volunteer registers successfully, the frontend calls the `send-email` Edge Function automatically.
- Ensure your `send-email` function is deployed to Supabase:
  ```bash
  supabase functions deploy send-email
  ```

## 3. Automated Daily Reminders
To send reminder emails automatically every day, you need to set up a scheduled job in Supabase.

### Option A: Using Scheduled Edge Functions (Recommended)
1. Go to your **Supabase Dashboard** > **Edge Functions**.
2. Click on the `send-reminders` function.
3. Look for "Schedule" or "Cron" settings (if available on your plan).

### Option B: Using Database Cron Job (pg_cron)
1. Go to **Supabase Dashboard** > **Database** > **Extensions**.
2. Search for `pg_cron` and enable it.
3. Go to **SQL Editor**.
4. Open the file `supabase/cron.sql` from this project.
5. Create a **New Query**, paste the content of `cron.sql`.
6. **IMPORTANT:** Replace `YOUR_SERVICE_ROLE_KEY` with your actual Service Role secret (found in Project Settings > API).
7. Run the query.

This will trigger the reminder function every day at 8:00 AM SGT (00:00 UTC).

## 4. Environment Variables
Ensure your Supabase project has the following secrets set in **Edge Functions** settings:
- `RESEND_API_KEY`: `re_TKGXn539_NADyEisN9B8CrSfLTQSyZg9R`
- `SUPABASE_URL`: `https://zpqnoxllhbyggyxvvpaa.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: (Your Service Role Secret)

## 5. Security Note
The Admin Dashboard (`/admin.html`) is protected by the password: `temple2026`.
Only share this with authorized administrators.
