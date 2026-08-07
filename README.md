# AntRep

Coach ↔ athlete training, on the web — a port of the antrip.health iOS app.
An athlete follows a plan (their own, or one synced from a coach), logs sets
with a live workout timer, and watches their progress; a coach builds plans,
assigns them, trains themselves, and sees every set their athletes log.

The interface mirrors the iOS app: tinted patterned canvas, soft cards, capsule
actions, progress rings, streaks and XP.

## Run it without a database

```bash
npm install
npm run dev            # then open http://localhost:5173/?demo=1
```

Demo mode keeps everything in `localStorage` and seeds three linked accounts —
password `demo1234` for all of them:

| Account | Who | What it's for |
|---|---|---|
| `athlete@antrep.app` | Alex Reps | A month into a 4-week block: two plans with history, extra work outside the plan, back-dated and private sessions, custom logging fields, a full coaching thread |
| `coach@antrep.app` | Coach Sam | Three linked athletes, a pending invite code, plan library, and their own training under **My training** |
| `priya@antrep.app` | Priya N | Joined mid-block and has gone quiet — the coach's "needs attention" flags and partial adherence |

It turns on automatically when Supabase credentials are missing, via `?demo=1`,
or from **Explore the demo** on the sign-in screen (`?demo=0` leaves).
**Settings → Reset demo data** re-seeds it.

## What's inside

**Athlete** — Home (greeting, streak, XP, the day's plan with inline set logging, live
workout timer, "start another day's workout" for a day you skipped, **extra exercises
outside the plan**, and a **date search — arrows, a picker, or the days you trained — to
back-fill anything you forgot**), Plans
(sync a coach's plan, build your own, read the full structure), Coach (chat, weekly
check-ins, trackers, your coach's notes), Progress (volume, sessions, records, balance,
insights, history) and Exercises (library + per-exercise charts and PRs).

**Coach** — Athletes (invite codes, pulse, unread badges), each athlete's Today /
Sessions / Progress / Plans / Coaching (chat, check-ins, notes, assessment trackers) plus
**.xlsx and .csv reports**, a plan builder that assigns to any athlete, and My training —
the full athlete app for the coach's own workouts on the same account.

### Reading the log

Progress works two ways: **Overall** or **per plan** — a chip row switches every
chart, read-out and table between them. The centrepiece is the **session log**: a
spreadsheet with exercises down the side and sessions (`S1, S2, S3…`, hover for the
date) across the top. Each exercise row shows its change vs the previous session it
was logged in, plus a plain-English remark; expand it for one row per set with the
actual numbers, `--` wherever nothing was logged. The arrow on a row opens that
exercise's full analytics.

### Logging methods

Every exercise carries how it is logged: weight × reps, reps only, distance & time,
hold/time, rounds, or purely custom fields. Anything extra a coach (or you) wants per set
— band colour, machine seat, RPE-of-the-day — is defined once as `{key,label,type,unit}`
on the exercise and stored in `set_logs.extra`, the same columns the coach's Excel export
and paste-import already use. Save a setup to your **exercise library** (Settings, or from
the plan editor) and that exercise logs the same way everywhere, in or out of a plan.

## Architecture

```
src/data/       backend contract (api.ts) + Supabase and demo implementations
src/domain/     pure training logic — plans, logging, analytics, XP, makeups
src/ui/         the iOS-styled kit (cards, rings, tab bar, charts)
src/app/        screens: athlete portal, coach portal, shared settings/history
src/features/   the previous UI, still served at /classic
```

`src/domain` has no React and no backend imports, so the same rules can be
reused by another client later (including the iOS app once it gets accounts).

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
   - SQL Editor → run [`supabase/migrations/001_progression_hub.sql`](supabase/migrations/001_progression_hub.sql) for progression tracking tables.
   - SQL Editor → run [`supabase/migrations/002_assessment_trackers.sql`](supabase/migrations/002_assessment_trackers.sql) for client profile & assessment trackers (Phase 2).
   - SQL Editor → run [`supabase/migrations/003_athlete_health_metrics.sql`](supabase/migrations/003_athlete_health_metrics.sql) for athlete health metrics in Settings.
   - SQL Editor → run [`supabase/migrations/005_ios_parity.sql`](supabase/migrations/005_ios_parity.sql) — **required for this version**: plan segments, the full exercise prescription, session timers, athlete-owned plans, XP and the exercise library. It is additive; existing rows are preserved.
   - **Demo data** (optional): run [`supabase/seed_demo.sql`](supabase/seed_demo.sql) in SQL Editor, or `npm run seed:demo` with `SUPABASE_SERVICE_ROLE_KEY` in `.env`.
     If demo login returns **500**, run [`supabase/hotfix_demo_auth_login.sql`](supabase/hotfix_demo_auth_login.sql) (NULL token columns on `auth.users`). Prefer `npm run seed:demo` when possible — it creates users via the Admin API and avoids this issue.
   - **Realtime** (optional but recommended): run [`supabase/migrations/004_realtime_publication.sql`](supabase/migrations/004_realtime_publication.sql) — safely adds Phase 1–2 tables only if missing. Do **not** re-add `sessions` or `set_logs`; they are usually already published and will error with `42710`.
     To inspect what is already published:
     ```sql
     SELECT tablename FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
     ORDER BY tablename;
     ```
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

**Coach tabs:** Home (dashboard) · Athletes (roster + per-athlete detail) · Plans · Inbox · Settings

**Athlete tabs:** Home (dashboard + today's workout) · Program (schedule / plan) · Progress · Inbox · Settings

1. Coach signs up at `/coach`, creates an invite code (Athletes tab).
2. Athlete signs up at `/`, enters the code in Settings → linked.
3. Coach builds the plan (Plans tab) — type exercises in, or **Paste from Excel**.
4. Athlete opens **Home** → logs today's workout inline (greeting + quote preserved).
5. Coach opens **Athletes** → tap an athlete for sessions, program, progress, analytics, assess. **Message** opens the Inbox thread.
6. **Inbox** (both roles): unified thread per coach–athlete link with chat + activity cards (sessions, check-ins, coach notes). Realtime updates.
7. Athlete **Program** tab: switch between Schedule (calendar) and Plan (week board).
8. **Progress** → Analytics (default for athletes), overload grid, check-ins, assessments.
9. Athlete **Settings** → Health metrics (height, weight, HR, etc.).
10. Export `.xlsx`/`.csv` uses your theme colors on header rows (coach session export + Warrior workbook).

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
- Database SQL: base schema lives locally / in Supabase; progression tables
  are in [`supabase/migrations/001_progression_hub.sql`](supabase/migrations/001_progression_hub.sql).
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
