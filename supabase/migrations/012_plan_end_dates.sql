-- ============================================================
-- 012 — Plan end dates and how a plan repeats
--
-- A plan ran forever. There was no way to say "this block finishes at the end
-- of March", so finished plans stayed in the active list and had to be
-- deactivated by hand — which loses the distinction between "I stopped this"
-- and "this ran its course".
--
--   end_date     optional. Past it, the plan stops scheduling and moves to
--                past plans. NULL keeps today's behaviour: runs indefinitely.
--
--   repeat_mode  'auto'   — the first block repeats for the plan's whole life.
--                'custom' — cycle through every block that has been set up.
--
-- `repeat_mode` exists because the block count alone can't express the
-- difference. A 4-week plan where only week 1 was ever filled in means "repeat
-- this week", not "three blank weeks then back to week 1" — and the fallback
-- that made those blank weeks show week 1's days hid the ambiguity rather than
-- resolving it. Existing rows default to 'auto', which is what they already did
-- in practice.
--
-- The assignment gets its own end_date so a coach can end one athlete's run of
-- a shared plan without ending everyone's, mirroring the start_date override
-- that is already there.
-- ============================================================

alter table public.plans
  add column if not exists end_date date,
  add column if not exists repeat_mode text not null default 'auto';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plans'::regclass and conname = 'plans_repeat_mode_check'
  ) then
    alter table public.plans
      add constraint plans_repeat_mode_check check (repeat_mode in ('auto', 'custom'));
  end if;
end;
$$;

-- A plan that ends before it starts would schedule nothing and read as a typo.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plans'::regclass and conname = 'plans_end_after_start'
  ) then
    alter table public.plans
      add constraint plans_end_after_start check (end_date is null or end_date >= start_date);
  end if;
end;
$$;

alter table public.plan_assignments
  add column if not exists end_date date;

-- Plans that already have more than one block filled in were cycling through
-- them, so keep them doing that; everything else is 'auto' by default.
update public.plans p
set repeat_mode = 'custom'
where p.repeat_mode = 'auto'
  and (
    select count(distinct d.week_index) from public.plan_days d where d.plan_id = p.id
  ) > 1;
