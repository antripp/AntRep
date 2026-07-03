# AntRep

Coach ↔ athlete workout logging. The coach builds the plan (or pastes it from
Excel), the athlete logs reps and weights from their phone, the coach watches
sessions roll in and exports `.xlsx`/`.csv` that matches their own sheet.

Two portals, one deploy:

| Portal | URL | For | Branding |
|---|---|---|---|
| **AntRep** | `/` | Athletes | dumbbell mascot |
| **AntRep Coach** | `/coach` | Trainers | clipboard mascot |

Both are installable as separate home-screen apps (PWA manifests per portal).

## Setup

1. **Supabase** (free tier is fine)
   - Create a project at [supabase.com](https://supabase.com).
   - SQL Editor → run your local database setup script (not stored in this repo).
   - **Bootstrap admin** (once, in SQL Editor — replace the UUID after your first signup):
     ```sql
     insert into public.app_config (key, value) values
       ('admin_user_id', '<your-auth-users-uuid-from-supabase-auth-dashboard>'),
       ('invite_pepper', '<random-32+-character-string>');
     ```
     Sign up once, copy your user UUID from Authentication → Users, then run the above.
     Approve accounts from **Settings → Admin — pending accounts** when logged in as that user.
   - Recommended for minimal-friction accounts: Authentication → Sign In / Up →
     Email → disable **Confirm email** (test users can sign in immediately).
2. **Env**
   ```sh
   cp .env.example .env
   # Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   # (Project Settings → API). Never use the service_role key in this app.
   ```
3. **Run**
   ```sh
   npm install
   npm run dev
   ```

## Usage flow

1. Coach signs up at `/coach`, creates an invite code (Athletes tab).
2. Athlete signs up at `/`, enters the code in Settings → linked.
3. Coach builds the plan (Plan tab) — type exercises in, or **Paste from
   Excel**: copy rows in the sheet, paste, map columns, import.
4. Athlete opens Today → Start workout → logs sets → Finish session →
   completion summary. Athletes can link several coaches (each plan shows as
   its own segment per day), start their own unplanned sessions, and browse
   the full multi-week programme on the Plan tab.
5. Coach sees sessions live (Sessions tab) and exports `.xlsx` (Summary +
   Sets sheets) or `.csv`. Column set and order are configurable in coach
   Settings to match the coach's own spreadsheet, including custom per-set
   fields (tempo, band colour, …) that also appear in the athlete's logger.

## Security model

- No data is stored on the device — everything lives in Postgres behind
  **Row-Level Security**: athletes reach only their own rows; coaches only
  rows of actively linked athletes.
- **Manual approval**: new coach and athlete profiles stay locked until an
  admin approves them via `approve_profile()` — only the UUID in
  `app_config.admin_user_id` can approve; emails are never exposed in the
  admin UI.
- **Dual profiles**: one login can have separate coach and athlete profiles;
  switching modes is done from Settings (each profile needs approval).
- Emails live only in Supabase auth (never in app tables, never visible to
  other users). Profiles carry just a display name and role.
- Invite codes are short (`ABC-123`), **hashed at rest**, **one-time use**,
  and **expire in 30 minutes**. Coaches can regenerate at any time.
- The `VITE_SUPABASE_ANON_KEY` in `.env` is a public browser key by design;
  RLS is what protects the data. The `service_role` key must never appear in
  this repo or Vercel env vars.

## GitHub / Vercel checklist

- `.env` is gitignored; set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only in
  Vercel → Project Settings → Environment Variables.
- Database SQL lives locally / in Supabase, not in this repository.
- After first deploy: confirm `app_config.admin_user_id` and `invite_pepper` are set
  in Supabase; enable email confirmation if you open signups to the public.

## Deploy

Any static host (Vercel/Netlify). Set the two `VITE_*` env vars in the host's
dashboard. SPA fallback: route all paths to `index.html`.

## Extending (interval training etc.)

- `plan_exercises.log_type` already allows `interval`; prescriptions go in
  `plan_exercises.prescription` (jsonb) — add a form in
  `src/features/coach/ExerciseForm.tsx` and a logger variant in
  `src/features/athlete/ExerciseLogger.tsx`.
- Per-set custom fields are already generic (`coach_settings.custom_fields` →
  `set_logs.extra`).
