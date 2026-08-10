-- ============================================================
-- 009 — Plan cycles: splits that repeat on their own length
--
-- Until now a plan was always a calendar week: `plan_days.weekday`
-- (1 = Monday … 7 = Sunday) inside `plan_days.week_index`, with the whole
-- block repeating every `plans.weeks` weeks off the nearest Monday.
--
-- That cannot express a 9-day split that starts over on the 10th day. So a
-- plan now picks a `schedule_mode`:
--
--   'weekly'  unchanged — week_index + weekday, Monday-aligned.
--   'cycle'   `cycle_length` days long; each day is a `cycle_day` (1-based),
--             and day 1 IS the plan's start date. Nothing is Monday-aligned.
--
-- Existing plans are untouched: the defaults keep every row in 'weekly' mode.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Plans: which schedule the plan runs on
-- ------------------------------------------------------------
alter table public.plans
  add column if not exists schedule_mode text not null default 'weekly',
  add column if not exists cycle_length integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plans'::regclass and conname = 'plans_schedule_mode_check'
  ) then
    alter table public.plans
      add constraint plans_schedule_mode_check
      check (schedule_mode in ('weekly', 'cycle'));
  end if;

  -- 0 for weekly plans (the column is meaningless there); a real cycle needs
  -- at least two days, and 60 is well past any split anyone actually runs.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plans'::regclass and conname = 'plans_cycle_length_check'
  ) then
    alter table public.plans
      add constraint plans_cycle_length_check
      check (cycle_length = 0 or cycle_length between 2 and 60);
  end if;

  -- The two must agree, so a mode switch can never leave a plan that
  -- resolves to no days at all.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plans'::regclass and conname = 'plans_cycle_mode_check'
  ) then
    alter table public.plans
      add constraint plans_cycle_mode_check
      check ((schedule_mode = 'cycle') = (cycle_length > 0));
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 2. Plan days: a cycle position instead of a weekday
--
-- `weekday` becomes nullable rather than being overloaded — a cycle's day 9
-- has no weekday, and writing a fake one there would make every existing
-- `weekdayLabel(day.weekday)` call quietly print the wrong name.
-- The existing 1..7 CHECK stays: it is NULL-tolerant, so it keeps guarding
-- weekly rows without rejecting cycle rows.
-- ------------------------------------------------------------
alter table public.plan_days
  add column if not exists cycle_day integer;

alter table public.plan_days
  alter column weekday drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plan_days'::regclass and conname = 'plan_days_cycle_day_check'
  ) then
    alter table public.plan_days
      add constraint plan_days_cycle_day_check
      check (cycle_day is null or cycle_day between 1 and 60);
  end if;

  -- Exactly one of the two addressing schemes per row.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plan_days'::regclass and conname = 'plan_days_slot_shape_check'
  ) then
    alter table public.plan_days
      add constraint plan_days_slot_shape_check
      check ((weekday is null) <> (cycle_day is null));
  end if;
end;
$$;

-- One row per slot, per addressing scheme. The old index covered weekly rows
-- only and would reject a whole cycle (every cycle row has weekday NULL, and
-- NULLs are distinct — but week_index would still collide once two cycle days
-- landed on the same weekday, which is why it has to be replaced rather than
-- kept alongside).
drop index if exists public.plan_days_slot;

create unique index if not exists plan_days_week_slot
  on public.plan_days (plan_id, week_index, weekday)
  where cycle_day is null;

create unique index if not exists plan_days_cycle_slot
  on public.plan_days (plan_id, week_index, cycle_day)
  where cycle_day is not null;
