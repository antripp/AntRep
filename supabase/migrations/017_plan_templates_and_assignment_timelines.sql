-- 017 — Date-free plan templates and per-athlete timelines
--
-- Plans describe duration and schedule shape only. Calendar dates belong to
-- an athlete's assignment (or to the activation of an athlete-owned plan).
-- Legacy start/end columns remain nullable for older clients and existing rows.

alter table public.plans
  alter column start_date drop not null;

alter table public.plans
  add column if not exists duration_days integer,
  add column if not exists split_lengths jsonb not null default '[7]'::jsonb,
  add column if not exists split_rest_days jsonb not null default '[0]'::jsonb;

-- Preserve the effective length of every existing template. A cycle's `weeks`
-- column historically meant number of splits; a weekly plan's meant weeks.
update public.plans
set duration_days = case
  when end_date is not null and start_date is not null
    then greatest(1, end_date - start_date + 1)
  when schedule_mode = 'cycle'
    then greatest(1, greatest(1, weeks) * greatest(2, cycle_length))
  else greatest(1, greatest(1, weeks) * 7)
end
where duration_days is null;

alter table public.plans
  alter column duration_days set default 28,
  alter column duration_days set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plans'::regclass
      and conname = 'plans_duration_days_check'
  ) then
    alter table public.plans
      add constraint plans_duration_days_check
      check (duration_days between 1 and 730);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plans'::regclass
      and conname = 'plans_split_arrays_check'
  ) then
    alter table public.plans
      add constraint plans_split_arrays_check
      check (
        jsonb_typeof(split_lengths) = 'array'
        and jsonb_array_length(split_lengths) between 1 and 52
        and jsonb_typeof(split_rest_days) = 'array'
        and jsonb_array_length(split_rest_days) = jsonb_array_length(split_lengths)
      );
  end if;
end;
$$;

comment on column public.plans.duration_days is
  'Overall template duration. Dates are applied only when an athlete run starts.';
comment on column public.plans.split_lengths is
  'Ordered active-day counts for cycle-mode splits; week_index selects the split.';
comment on column public.plans.split_rest_days is
  'Rest days after each cycle-mode split, including the final split before repetition.';
comment on column public.plans.start_date is
  'Legacy / athlete-owned activation start. Coach templates should leave this null.';
comment on column public.plans.end_date is
  'Legacy / athlete-owned activation end. Coach assignments use plan_assignments.end_date.';

alter table public.plan_assignments
  add column if not exists activation_mode text not null default 'scheduled';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plan_assignments'::regclass
      and conname = 'plan_assignments_activation_mode_check'
  ) then
    alter table public.plan_assignments
      add constraint plan_assignments_activation_mode_check
      check (activation_mode in ('scheduled', 'manual'));
  end if;
end;
$$;

-- A newly selected start date gets the template's inclusive end date. An
-- explicitly supplied end remains supported for existing per-athlete edits.
create or replace function public.plan_assignment_default_end()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duration integer;
begin
  if new.start_date is null then
    new.end_date := null;
    return new;
  end if;

  select duration_days into v_duration
  from public.plans
  where id = new.plan_id;

  if new.end_date is null
     or (tg_op = 'UPDATE'
         and new.start_date is distinct from old.start_date
         and new.end_date is not distinct from old.end_date) then
    new.end_date := new.start_date + greatest(1, coalesce(v_duration, 1)) - 1;
  end if;

  return new;
end;
$$;

drop trigger if exists plan_assignment_default_end_trigger on public.plan_assignments;
create trigger plan_assignment_default_end_trigger
before insert or update of start_date, plan_id, end_date
on public.plan_assignments
for each row execute function public.plan_assignment_default_end();

-- If a template duration changes, update only ends that were still following
-- the old automatic duration. Deliberate custom end dates remain untouched.
create or replace function public.plan_duration_sync_assignment_ends()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.duration_days is distinct from old.duration_days then
    update public.plan_assignments
    set end_date = start_date + new.duration_days - 1
    where plan_id = new.id
      and start_date is not null
      and (
        end_date is null
        or end_date = start_date + old.duration_days - 1
      );
  end if;
  return new;
end;
$$;

drop trigger if exists plan_duration_sync_assignment_ends_trigger on public.plans;
create trigger plan_duration_sync_assignment_ends_trigger
after update of duration_days on public.plans
for each row execute function public.plan_duration_sync_assignment_ends();

-- Backfill split metadata from the legacy fixed-length representation.
update public.plans p
set split_lengths = case
      when p.schedule_mode = 'cycle'
        then to_jsonb(array_fill(greatest(2, p.cycle_length), array[greatest(1, p.weeks)]))
      else '[7]'::jsonb
    end,
    split_rest_days = case
      when p.schedule_mode = 'cycle'
        then to_jsonb(array_fill(0, array[greatest(1, p.weeks)]))
      else '[0]'::jsonb
    end
where p.split_lengths = '[7]'::jsonb
  and p.split_rest_days = '[0]'::jsonb;
