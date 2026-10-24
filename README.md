# Balasanka HR Portal v2

Recruitment and onboarding portal for Balasanka Group of Companies. It replaces the old Flask + Google Sheets app with **Next.js 15**, **Supabase** (Postgres database, logins, private file storage) and **Vercel** hosting.

New online applications come in through the portal's own page, **https://hr.balasanka.in/apply** (it replaced the Google Form). The new candidate goes straight to the branch's HR with a notification. Admins edit the form's questions and the post list on the **Admin** page. Each application saves its answers under the question wording used at the time, so editing, reordering or deleting a question never changes past applications.

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
| Public apply page and admin-managed questions | `app/apply`, `app/admin/questions.tsx`, `lib/apply-questions.ts`, `0006`/`0007` migrations |
| Google Sheet one-time import (the 15-minute sync is off since `0008`) | `lib/sheet-sync.ts`, `app/api/sync-sheet` |
| Database schema and access rules | `supabase/migrations/` |

## Who sees what

Access is enforced by the database itself (row level security), not only by the screens.

- **admin**: everything, plus Reports and Admin.
- **HR (lithiga, aarthi, rishi)**: candidates assigned to them.
- **Branch accounts** (one per showroom): walk-ins at their branch, and online applicants for their branch once an interview is scheduled.

Candidate links (offer letter, appointment letter, onboarding form) use a random secret token instead of the mobile number, so they can't be guessed.

## Setup

The app only ever uses the public (anon) key. Anything that needs more rights is a small database function with its own checks (see `0002_no_service_role.sql`), and the Sheet sync signs in as its own admin account. There is no service-role key to leak.

1. **Supabase.** Create a project. In the SQL editor, run the files in `supabase/migrations/` in order.
2. **Environment.** Copy `.env.example` to `.env.local` and fill it in. Never commit `.env.local` or any Google key file.
3. **Install:** `npm install`
4. **Create branches and logins:** `npm run seed:users` writes `seed-users.local.sql` and `passwords.local.txt`. Paste the SQL into the Supabase SQL editor and run it. Share each password privately, then delete both files. Put the `sheet-sync` password in `SYNC_PASSWORD`.
5. **Import the Sheet (one time):** share the Google Sheet with the service account email (read-only is enough), put the service account JSON in `GOOGLE_SERVICE_ACCOUNT_JSON`, then run `npm run import:sheet`.
6. **Run locally:** `npm run dev` and open http://localhost:3000
7. **Deploy:** import the GitHub repo in Vercel, add the same environment variables, and deploy. The old 15-minute Sheet sync (`0004`) was switched off in `0008` once `/apply` went live. The live site is https://hr.balasanka.in.

### Adding a staff login later

In the Supabase SQL editor:

```sql
select create_staff_user('newname', 'Full Name', 'hr', null, 'newname@staff.balasanka-hr.local', 'a-long-random-password');
```

Admins can reset anyone's password from the Admin page.

### Before going live

- **Rotate the old Google service account key.** The old app kept `credentials.json` in its folder, outside `.gitignore`. In Google Cloud Console, delete that key and create a new one for this app.
- Old onboarding files that the import brings across are still public Google Drive links ("anyone with the link"). Turn off link sharing on that Drive folder after the import. HR can still open the files while signed in to Google.

## Checks

```bash
npm test      # pipeline, salary, probation, sheet-date rules
npm run lint  # TypeScript
npm run build
```
