-- Stable canonical link to the wger exercise database used by antrip.health.
-- Name and logging fields remain user-owned, so existing history/progression is untouched.
alter table public.exercise_presets
  add column if not exists wger_exercise_id integer;

create index if not exists exercise_presets_wger_id_idx
  on public.exercise_presets (owner_id, wger_exercise_id)
  where wger_exercise_id is not null;
