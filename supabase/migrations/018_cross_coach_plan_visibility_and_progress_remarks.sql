-- ============================================================
-- 018 — Cross-coach plan visibility + progressive plan guidance
--
-- A linked coach may understand every plan their athlete is following, while
-- only the plan owner may change the template, assignment, or guidance.
-- Guidance is stored per assignment so it can progress independently for each
-- athlete at plan, week/split, and exercise-within-week level.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Read every assigned plan for a linked athlete.
-- ------------------------------------------------------------
create or replace function public.can_athlete_read_plan(p_plan uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- The signed-in athlete has this plan assigned by a linked coach.
  select exists (
    select 1
    from public.plan_assignments a
    join public.plans p on p.id = a.plan_id
    where a.plan_id = p_plan
      and a.athlete_id = public.my_profile_id('athlete')
      and public.is_linked(coalesce(p.owner_id, p.trainer_id), a.athlete_id)
  )
  -- A linked coach can read any plan assigned to their athlete, regardless of
  -- which coach owns it. Write policies remain owner-only below.
  or exists (
    select 1
    from public.plan_assignments a
    where a.plan_id = p_plan
      and public.is_linked(public.my_profile_id('coach'), a.athlete_id)
  )
  -- A coach can also read an athlete-authored plan belonging to their athlete.
  or exists (
    select 1
    from public.plans p
    where p.id = p_plan
      and public.is_linked(public.my_profile_id('coach'), coalesce(p.owner_id, p.trainer_id))
  );
$$;

revoke all on function public.can_athlete_read_plan(uuid) from public, anon;
grant execute on function public.can_athlete_read_plan(uuid) to authenticated;

drop policy if exists plan_days_shared_select on public.plan_days;
create policy plan_days_shared_select on public.plan_days for select
  using (public.can_athlete_read_plan(plan_id));

drop policy if exists plan_exercises_shared_select on public.plan_exercises;
create policy plan_exercises_shared_select on public.plan_exercises for select
  using (exists (
    select 1 from public.plan_days d
    where d.id = plan_day_id and public.can_athlete_read_plan(d.plan_id)
  ));

-- Read assignment state for all plans followed by a linked athlete. The owner
-- retains write access; a different linked coach receives SELECT only.
drop policy if exists assignments_linked_coach_select on public.plan_assignments;
create policy assignments_linked_coach_select on public.plan_assignments for select
  using (
    athlete_id = public.my_profile_id('athlete')
    or public.is_linked(public.my_profile_id('coach'), athlete_id)
    or public.is_plan_owner(plan_id)
  );

drop policy if exists assignments_plan_owner_all on public.plan_assignments;
create policy assignments_plan_owner_all on public.plan_assignments for all
  using (public.is_plan_owner(plan_id))
  with check (public.is_plan_owner(plan_id));

-- Let the coach UI name the owner of a plan assigned to its linked athlete.
create or replace function public.can_read_assigned_plan_owner(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.plan_assignments a
    join public.plans p on p.id = a.plan_id
    where coalesce(p.owner_id, p.trainer_id) = p_profile
      and public.is_linked(public.my_profile_id('coach'), a.athlete_id)
  );
$$;

revoke all on function public.can_read_assigned_plan_owner(uuid) from public, anon;
grant execute on function public.can_read_assigned_plan_owner(uuid) to authenticated;

drop policy if exists profiles_assigned_plan_owner_select on public.profiles;
create policy profiles_assigned_plan_owner_select on public.profiles for select
  using (public.can_read_assigned_plan_owner(id));

-- ------------------------------------------------------------
-- 2. Progressive guidance for one assignment.
-- ------------------------------------------------------------
create table if not exists public.plan_assignment_remarks (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.plan_assignments(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null check (scope in ('plan', 'week', 'exercise')),
  week_index integer,
  plan_exercise_id uuid references public.plan_exercises(id) on delete cascade,
  note text not null check (char_length(trim(note)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_assignment_remarks_target_check check (
    (scope = 'plan' and week_index is null and plan_exercise_id is null)
    or (scope = 'week' and week_index >= 1 and plan_exercise_id is null)
    or (scope = 'exercise' and week_index >= 1 and plan_exercise_id is not null)
  )
);

create unique index if not exists plan_assignment_remarks_target_unique
  on public.plan_assignment_remarks (
    assignment_id,
    scope,
    coalesce(week_index, 0),
    coalesce(plan_exercise_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists plan_assignment_remarks_assignment_idx
  on public.plan_assignment_remarks (assignment_id, week_index, scope);

alter table public.plan_assignment_remarks enable row level security;

create or replace function public.can_read_plan_assignment_remark(p_assignment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.plan_assignments a
    where a.id = p_assignment
      and (
        a.athlete_id = public.my_profile_id('athlete')
        or public.is_linked(public.my_profile_id('coach'), a.athlete_id)
        or public.is_plan_owner(a.plan_id)
      )
  );
$$;

create or replace function public.can_write_plan_assignment_remark(
  p_assignment uuid,
  p_coach uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.plan_assignments a
    where a.id = p_assignment
      and public.is_plan_owner(a.plan_id)
      and p_coach = public.my_profile_id('coach')
  );
$$;

revoke all on function public.can_read_plan_assignment_remark(uuid) from public, anon;
grant execute on function public.can_read_plan_assignment_remark(uuid) to authenticated;
revoke all on function public.can_write_plan_assignment_remark(uuid, uuid) from public, anon;
grant execute on function public.can_write_plan_assignment_remark(uuid, uuid) to authenticated;

drop policy if exists plan_assignment_remarks_select on public.plan_assignment_remarks;
create policy plan_assignment_remarks_select on public.plan_assignment_remarks for select
  using (public.can_read_plan_assignment_remark(assignment_id));

drop policy if exists plan_assignment_remarks_insert on public.plan_assignment_remarks;
create policy plan_assignment_remarks_insert on public.plan_assignment_remarks for insert
  with check (public.can_write_plan_assignment_remark(assignment_id, coach_id));

drop policy if exists plan_assignment_remarks_update on public.plan_assignment_remarks;
create policy plan_assignment_remarks_update on public.plan_assignment_remarks for update
  using (public.can_write_plan_assignment_remark(assignment_id, coach_id))
  with check (public.can_write_plan_assignment_remark(assignment_id, coach_id));

drop policy if exists plan_assignment_remarks_delete on public.plan_assignment_remarks;
create policy plan_assignment_remarks_delete on public.plan_assignment_remarks for delete
  using (public.can_write_plan_assignment_remark(assignment_id, coach_id));

create or replace function public.touch_plan_assignment_remark()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists plan_assignment_remarks_touch on public.plan_assignment_remarks;
create trigger plan_assignment_remarks_touch
before update on public.plan_assignment_remarks
for each row execute function public.touch_plan_assignment_remark();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.plan_assignment_remarks;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;
