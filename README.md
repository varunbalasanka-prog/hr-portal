# Balasanka HR Portal v2

Recruitment and onboarding portal for Balasanka Group of Companies. It replaces the old Flask + Google Sheets app with **Next.js 15**, **Supabase** (Postgres database, logins, private file storage) and **Vercel** hosting.

New online applications still come in through the existing **Google Form**. Every 15 minutes the app copies new rows from the Sheet's *Master Sheet* tab into the database. From then on, all pipeline work happens in the app, not in the Sheet.

## What's in it

| Area | Where |
| --- | --- |
| Login (username + password, hashed by Supabase Auth) | `app/login` |
| Dashboard: follow-up, completed, rejected, onboarding lists, today's work, reminders, search | `app/dashboard`, `components/dashboard.tsx` |
| Pipeline updates (calls, retries, interview, reschedule, joining, revised joining, left) | `lib/pipeline.ts`, `components/stage-form.tsx` |
| Walk-in entry with duplicate and blacklist check | `components/walkin-form.tsx` |
| Offer and appointment letters (English + Tamil, print to PDF, WhatsApp share) | `app/letters` |
| Candidate onboarding form (documents go to a private bucket) | `app/onboard/[token]` |
| In-app notifications with read tracking | `components/notifications.tsx` |
| Reports (admin) and password reset / notification log (admin) | `app/reports`, `app/admin` |
| Google Sheet one-time import and 15-minute sync | `lib/sheet-sync.ts`, `app/api/sync-sheet` |
| Database schema and access rules | `supabase/migrations/0001_init.sql` |

## Who sees what

Access is enforced by the database itself (row level security), not only by the screens.

- **admin**: everything, plus Reports and Admin.
- **HR (lithiga, aarthi, rishi)**: candidates assigned to them.
- **Branch accounts** (one per showroom): walk-ins at their branch, and online applicants for their branch once an interview is scheduled.

Candidate links (offer letter, appointment letter, onboarding form) use a random secret token instead of the mobile number, so they can't be guessed.

## Setup

1. **Supabase.** Create a project. In the SQL editor, run `supabase/migrations/0001_init.sql`.
2. **Environment.** Copy `.env.example` to `.env.local` and fill it in. Never commit `.env.local` or any Google key file.
3. **Install:** `npm install`
4. **Create branches and logins:** `npm run seed:users`. Every account gets a random password, printed once. Share each one privately.
5. **Import the Sheet (one time):** share the Google Sheet with the service account email (read-only is enough), put the service account JSON in `GOOGLE_SERVICE_ACCOUNT_JSON`, then run `npm run import:sheet`. It's safe to run again.
6. **Run locally:** `npm run dev` and open http://localhost:3000
7. **Deploy:** import the GitHub repo in Vercel, add the same environment variables, and deploy. `vercel.json` schedules the Sheet sync every 15 minutes. Set `CRON_SECRET` so only Vercel can call it.

### Before going live

- **Rotate the old Google service account key.** The old app kept `credentials.json` in its folder, outside `.gitignore`. In Google Cloud Console, delete that key and create a new one for this app.
- Old onboarding files that the import brings across are still public Google Drive links ("anyone with the link"). Turn off link sharing on that Drive folder after the import. HR can still open the files while signed in to Google.

## Checks

```bash
npm test      # pipeline, salary, probation, sheet-date rules
npm run lint  # TypeScript
npm run build
```
