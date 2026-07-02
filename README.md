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
   - SQL Editor → New query → paste and run `supabase/schema.sql`.
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
   completion summary.
5. Coach sees sessions live (Sessions tab) and exports `.xlsx` (Summary +
   Sets sheets) or `.csv`. Column set and order are configurable in coach
   Settings to match the coach's own spreadsheet, including custom per-set
   fields (tempo, band colour, …) that also appear in the athlete's logger.

## Security model

- No data is stored on the device — everything lives in Postgres behind
  **Row-Level Security** (see `supabase/schema.sql`): athletes reach only
  their own rows; coaches only rows of actively linked athletes.
- Emails live only in Supabase auth (never in app tables, never visible to
  other users). Profiles carry just a display name and role.
- Invite claiming runs through a `security definer` function so invite codes
  can't be enumerated through the API.
- The `VITE_SUPABASE_ANON_KEY` in `.env` is a public browser key by design;
  RLS is what protects the data. The `service_role` key must never appear in
  this repo.

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
