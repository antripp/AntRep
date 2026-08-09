-- ============================================================
-- 010 — Half-step RPE
--
-- RPE is logged per set on a 0.5 scale (`set_logs.rpe` is already numeric),
-- but the coach's *target* was an integer, so "RPE 7.5" could be recorded and
-- never prescribed. Widen it to match what the logger accepts.
--
-- `plan_exercises.set_details` — the per-set breakdown the logger seeds rows
-- from — already exists as jsonb on every install, so it needs no change here;
-- 005 only ever added `custom_fields` alongside it.
-- ============================================================

alter table public.plan_exercises
  alter column rpe_target type numeric(3, 1) using rpe_target::numeric(3, 1);

alter table public.plan_exercises
  alter column rpe_target set default 0;

-- Nothing outside 0–10 can be prescribed; 0 keeps meaning "no target".
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plan_exercises'::regclass
      and conname = 'plan_exercises_rpe_target_range'
  ) then
    alter table public.plan_exercises
      add constraint plan_exercises_rpe_target_range
      check (rpe_target >= 0 and rpe_target <= 10);
  end if;
end;
$$;

-- Same for what actually gets logged: a stray 99 in an import would wreck
-- every average built on top of it.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.set_logs'::regclass
      and conname = 'set_logs_rpe_range'
  ) then
    alter table public.set_logs
      add constraint set_logs_rpe_range
      check (rpe is null or (rpe >= 0 and rpe <= 10));
  end if;
end;
$$;
