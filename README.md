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
  admin approves them; emails are never exposed in the
  admin UI.
- **Dual profiles**: one login can have separate coach and athlete profiles;
  switching modes is done from Settings (each profile needs approval).
- Emails live only in Supabase auth (never in app tables, never visible to
  other users). Profiles carry just a display name and role.
- Invite codes are short (`ABC-123`), **hashed at rest**, **one-time use**,
  and **expire in 30 minutes**. Coaches can regenerate at any time.


